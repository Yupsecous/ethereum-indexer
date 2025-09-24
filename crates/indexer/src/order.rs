use crate::exec::{OrderingKey, Range};
use futures::{Stream, StreamExt};
use std::collections::BTreeMap;
use std::pin::Pin;
use std::task::{Context, Poll};

pub fn order_by_range<S, T>(stream: S, start: u64) -> impl Stream<Item = anyhow::Result<(Range, T)>>
where
    S: Stream<Item = anyhow::Result<(OrderingKey, T)>> + Unpin,
{
    OrderedStream {
        inner: stream,
        buffer: BTreeMap::new(),
        next_expected: start,
    }
}

struct OrderedStream<S, T> {
    inner: S,
    buffer: BTreeMap<u64, (u64, T)>, // from -> (to, value)
    next_expected: u64,
}

impl<S, T> Stream for OrderedStream<S, T>
where
    S: Stream<Item = anyhow::Result<(OrderingKey, T)>> + Unpin,
{
    type Item = anyhow::Result<(Range, T)>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        // 1) If next-needed is already buffered, emit it.
        let need = self.next_expected;
        if let Some((to, value)) = self.buffer.remove(&need) {
            let r = Range { from: need, to };
            self.next_expected = to + 1;
            return Poll::Ready(Some(Ok((r, value))));
        }

        // 2) Otherwise poll the inner once.
        match self.inner.poll_next_unpin(cx) {
            Poll::Ready(Some(Ok((OrderingKey::Range(r), v)))) => {
                if r.from == self.next_expected {
                    self.next_expected = r.to + 1;
                    Poll::Ready(Some(Ok((r, v))))
                } else {
                    // out-of-order -> buffer and wait for more data
                    self.buffer.insert(r.from, (r.to, v));

                    // optional: try one *more* immediate buffer emit
                    if let Some((to, value)) = self.buffer.remove(&need) {
                        let r = Range { from: need, to };
                        self.next_expected = to + 1;
                        Poll::Ready(Some(Ok((r, value))))
                    } else {
                        // no ready item -> Pending; inner will wake us later
                        Poll::Pending
                    }
                }
            }
            Poll::Ready(Some(Ok((OrderingKey::None, _v)))) => Poll::Ready(Some(Err(
                anyhow::anyhow!("Unordered item in ordered stream"),
            ))),
            Poll::Ready(Some(Err(e))) => Poll::Ready(Some(Err(e))),
            Poll::Ready(None) => {
                // Inner is done; if buffer can emit next, emit it; else finish.
                if let Some((to, value)) = self.buffer.remove(&need) {
                    let r = Range { from: need, to };
                    self.next_expected = to + 1;
                    Poll::Ready(Some(Ok((r, value))))
                } else {
                    Poll::Ready(None)
                }
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

pub fn chunk_range(r: Range, chunk_size: u64) -> impl Iterator<Item = Range> {
    let mut s = r.from;
    std::iter::from_fn(move || {
        if s > r.to {
            return None;
        }
        let e = (s + chunk_size - 1).min(r.to);
        let out = Range { from: s, to: e };
        s = e.saturating_add(1);
        Some(out)
    })
}
