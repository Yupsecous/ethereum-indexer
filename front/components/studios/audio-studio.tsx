"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Upload,
  Save,
  Download,
  Music,
  Volume2,
  VolumeX,
  ChevronDown,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface AudioStudioProps {
  onBack: () => void
}

export default function AudioStudio({ onBack }: AudioStudioProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(75)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Simulate waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#000"

    // Draw a simulated waveform
    const barWidth = 3
    const gap = 2
    const bars = Math.floor(width / (barWidth + gap))

    for (let i = 0; i < bars; i++) {
      // Generate random heights for the waveform visualization
      const barHeight = Math.random() * (height * 0.8) + height * 0.1
      ctx.fillRect(i * (barWidth + gap), (height - barHeight) / 2, barWidth, barHeight)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0])
    }
  }

  return (
    <Card className="border-4 border-black rounded-xl p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <Button variant="outline" className="mb-4 border-2 border-black rounded-xl font-bold" onClick={onBack}>
        Back to Studios
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-black mb-4">AUDIO STUDIO</h2>

          {/* Audio upload section */}
          <div className="mb-6">
            <div className="border-4 border-dashed border-black rounded-xl p-4 sm:p-8 text-center mb-4">
              {audioFile ? (
                <div>
                  <Music className="mx-auto h-8 w-8 sm:h-10 sm:w-10 mb-2" />
                  <p className="font-bold">{audioFile.name}</p>
                  <p className="text-sm text-gray-500">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <>
                  <Music className="mx-auto h-8 w-8 sm:h-10 sm:w-10 mb-2 opacity-50" />
                  <p className="mb-2">Drop your audio file here or</p>
                  <Button
                    variant="outline"
                    className="border-2 border-black rounded-xl font-bold"
                    onClick={() => document.getElementById("audio-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Select File
                  </Button>
                  <input
                    id="audio-upload"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </>
              )}
            </div>
          </div>

          {/* Waveform visualization */}
          <div className="mb-6 bg-white/50 border-4 border-black rounded-xl p-4">
            <div className="bg-white border-2 border-black rounded-lg p-2">
              <canvas ref={canvasRef} width={800} height={150} className="w-full h-[100px] sm:h-[150px]" />
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" className="border-2 border-black rounded-xl h-10 w-10 p-0">
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                className="bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black h-12 w-12 p-0"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl h-10 w-10 p-0">
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile-only controls */}
          <div className="block lg:hidden mb-6">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-black text-white rounded-xl font-bold">
                <span>Audio Controls</span>
                <ChevronDown className="h-5 w-5" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4 p-4 border-2 border-black rounded-xl">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label className="font-bold">Volume</Label>
                    <div className="flex items-center">
                      {volume === 0 ? <VolumeX className="h-4 w-4 mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}
                      <span>{volume}%</span>
                    </div>
                  </div>
                  <Slider
                    value={[volume]}
                    max={100}
                    step={1}
                    className="py-4"
                    onValueChange={(value) => setVolume(value[0])}
                  />
                </div>

                <div>
                  <Label className="font-bold mb-2 block">Bass</Label>
                  <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                </div>

                <div>
                  <Label className="font-bold mb-2 block">Mid</Label>
                  <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                </div>

                <div>
                  <Label className="font-bold mb-2 block">Treble</Label>
                  <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Button className="bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold">
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                  <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Desktop-only controls panel */}
        <div className="hidden lg:block w-[300px]">
          <Card className="border-4 border-black rounded-xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="bg-gradient-to-br from-pink-500 to-orange-500 p-4 text-white">
              <h3 className="text-xl font-bold">Audio Controls</h3>
            </div>
            <div className="p-4 bg-white">
              <Tabs defaultValue="mixer">
                <TabsList className="bg-white/50 border-2 border-black rounded-xl p-1 mb-4 w-full">
                  <TabsTrigger
                    value="mixer"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Mixer
                  </TabsTrigger>
                  <TabsTrigger
                    value="effects"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Effects
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="mixer" className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label className="font-bold">Volume</Label>
                      <div className="flex items-center">
                        {volume === 0 ? <VolumeX className="h-4 w-4 mr-2" /> : <Volume2 className="h-4 w-4 mr-2" />}
                        <span>{volume}%</span>
                      </div>
                    </div>
                    <Slider
                      value={[volume]}
                      max={100}
                      step={1}
                      className="py-4"
                      onValueChange={(value) => setVolume(value[0])}
                    />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Bass</Label>
                    <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Mid</Label>
                    <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Treble</Label>
                    <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                  </div>
                </TabsContent>

                <TabsContent value="effects" className="space-y-4">
                  <div>
                    <Label className="font-bold mb-2 block">Reverb</Label>
                    <Slider defaultValue={[20]} max={100} step={1} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Delay</Label>
                    <Slider defaultValue={[10]} max={100} step={1} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Compression</Label>
                    <Slider defaultValue={[30]} max={100} step={1} className="py-4" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Noise Reduction</Label>
                    <Switch defaultChecked />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 space-y-3">
                <Button className="w-full bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold">
                  <Save className="h-4 w-4 mr-2" /> Save Project
                </Button>
                <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold">
                  <Download className="h-4 w-4 mr-2" /> Export Audio
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  )
}
