"use client"

import type React from "react"

import { useState, useRef } from "react"
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
  Scissors,
  Layers,
  Film,
  Text,
  ImageIcon,
  ChevronDown,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface VideoStudioProps {
  onBack: () => void
}

export default function VideoStudio({ onBack }: VideoStudioProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0])

      // Create object URL for preview
      const videoElement = videoRef.current
      if (videoElement) {
        videoElement.src = URL.createObjectURL(e.target.files[0])
      }
    }
  }

  const togglePlay = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    if (isPlaying) {
      videoElement.pause()
    } else {
      videoElement.play()
    }

    setIsPlaying(!isPlaying)
  }

  return (
    <Card className="border-4 border-black rounded-xl p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <Button variant="outline" className="mb-4 border-2 border-black rounded-xl font-bold" onClick={onBack}>
        Back to Studios
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-black mb-4">VIDEO STUDIO</h2>

          {/* Video preview section */}
          <div className="mb-6">
            {videoFile ? (
              <div className="border-4 border-black rounded-xl overflow-hidden bg-black">
                <video ref={videoRef} className="w-full aspect-video" controls={false} />
              </div>
            ) : (
              <div className="border-4 border-dashed border-black rounded-xl p-4 sm:p-8 text-center mb-4 aspect-video flex flex-col items-center justify-center">
                <Film className="h-12 w-12 sm:h-16 sm:w-16 mb-4 opacity-50" />
                <p className="mb-4">Drop your video file here or</p>
                <Button
                  variant="outline"
                  className="border-2 border-black rounded-xl font-bold"
                  onClick={() => document.getElementById("video-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" /> Select Video
                </Button>
                <input id="video-upload" type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
              </div>
            )}
          </div>

          {/* Timeline */}
          {videoFile && (
            <div className="mb-6">
              <div className="bg-white/50 border-4 border-black rounded-xl p-4">
                <div className="bg-white border-2 border-black rounded-lg p-2 h-[80px] sm:h-[100px] mb-4">
                  {/* Timeline tracks would go here */}
                  <div className="flex h-full">
                    <div className="w-12 sm:w-16 h-full border-r-2 border-black flex flex-col justify-center items-center">
                      <Film className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs font-bold mt-1">Video</span>
                    </div>
                    <div className="flex-1 bg-gray-100 relative">
                      <div className="absolute top-0 left-[20%] bottom-0 w-[60%] bg-blue-200 border-2 border-blue-400 rounded-md flex items-center justify-center">
                        <span className="text-xs font-bold">Main Clip</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Playback controls */}
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" className="border-2 border-black rounded-xl h-10 w-10 p-0">
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button
                    className="bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black h-12 w-12 p-0"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <Button variant="outline" className="border-2 border-black rounded-xl h-10 w-10 p-0">
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile-only controls */}
          <div className="block lg:hidden mb-6">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-black text-white rounded-xl font-bold">
                <span>Video Controls</span>
                <ChevronDown className="h-5 w-5" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4 p-4 border-2 border-black rounded-xl">
                <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                  <Scissors className="h-4 w-4" /> Split Clip
                </Button>

                <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                  <Layers className="h-4 w-4" /> Add Layer
                </Button>

                <div>
                  <Label className="font-bold mb-2 block">Playback Speed</Label>
                  <Slider defaultValue={[100]} max={200} step={10} className="py-4" />
                </div>

                <div>
                  <Label className="font-bold mb-2 block">Volume</Label>
                  <Slider defaultValue={[80]} max={100} step={1} className="py-4" />
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
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-4 text-white">
              <h3 className="text-xl font-bold">Video Controls</h3>
            </div>
            <div className="p-4 bg-white">
              <Tabs defaultValue="edit">
                <TabsList className="bg-white/50 border-2 border-black rounded-xl p-1 mb-4 w-full">
                  <TabsTrigger
                    value="edit"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Edit
                  </TabsTrigger>
                  <TabsTrigger
                    value="effects"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Effects
                  </TabsTrigger>
                  <TabsTrigger
                    value="text"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Text
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-4">
                  <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                    <Scissors className="h-4 w-4" /> Split Clip
                  </Button>

                  <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                    <Layers className="h-4 w-4" /> Add Layer
                  </Button>

                  <div>
                    <Label className="font-bold mb-2 block">Playback Speed</Label>
                    <Slider defaultValue={[100]} max={200} step={10} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Volume</Label>
                    <Slider defaultValue={[80]} max={100} step={1} className="py-4" />
                  </div>
                </TabsContent>

                <TabsContent value="effects" className="space-y-4">
                  <div>
                    <Label className="font-bold mb-2 block">Brightness</Label>
                    <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Contrast</Label>
                    <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Saturation</Label>
                    <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Stabilization</Label>
                    <Switch defaultChecked />
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-4">
                  <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                    <Text className="h-4 w-4" /> Add Title
                  </Button>

                  <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                    <Text className="h-4 w-4" /> Add Caption
                  </Button>

                  <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold flex gap-2">
                    <ImageIcon className="h-4 w-4" /> Add Sticker
                  </Button>
                </TabsContent>
              </Tabs>

              <div className="mt-6 space-y-3">
                <Button className="w-full bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold">
                  <Save className="h-4 w-4 mr-2" /> Save Project
                </Button>
                <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold">
                  <Download className="h-4 w-4 mr-2" /> Export Video
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  )
}
