"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  Save,
  Download,
  Crop,
  Layers,
  ImageIcon,
  Paintbrush,
  Eraser,
  RotateCcw,
  ChevronDown,
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ImageStudioProps {
  onBack: () => void
}

export default function ImageStudio({ onBack }: ImageStudioProps) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeFilter, setActiveFilter] = useState("none")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)

      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setImagePreview(e.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Apply filter effect to canvas when filter changes
  useEffect(() => {
    if (!imagePreview || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Set canvas dimensions to match image
      canvas.width = img.width
      canvas.height = img.height

      // Draw original image
      ctx.drawImage(img, 0, 0)

      // Apply filter based on selection
      switch (activeFilter) {
        case "grayscale":
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
            data[i] = avg // red
            data[i + 1] = avg // green
            data[i + 2] = avg // blue
          }
          ctx.putImageData(imageData, 0, 0)
          break

        case "sepia":
          const sepiaData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const sepiaPixels = sepiaData.data
          for (let i = 0; i < sepiaPixels.length; i += 4) {
            const r = sepiaPixels[i]
            const g = sepiaPixels[i + 1]
            const b = sepiaPixels[i + 2]

            sepiaPixels[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
            sepiaPixels[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
            sepiaPixels[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
          }
          ctx.putImageData(sepiaData, 0, 0)
          break

        case "invert":
          const invertData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const invertPixels = invertData.data
          for (let i = 0; i < invertPixels.length; i += 4) {
            invertPixels[i] = 255 - invertPixels[i] // red
            invertPixels[i + 1] = 255 - invertPixels[i + 1] // green
            invertPixels[i + 2] = 255 - invertPixels[i + 2] // blue
          }
          ctx.putImageData(invertData, 0, 0)
          break

        case "none":
        default:
          // No filter, already drawn original image
          break
      }
    }
    img.src = imagePreview
  }, [imagePreview, activeFilter])

  return (
    <Card className="border-4 border-black rounded-xl p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <Button variant="outline" className="mb-4 border-2 border-black rounded-xl font-bold" onClick={onBack}>
        Back to Studios
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-black mb-4">IMAGE STUDIO</h2>

          {/* Image preview section */}
          <div className="mb-6">
            {imagePreview ? (
              <div className="border-4 border-black rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                <canvas ref={canvasRef} className="max-w-full max-h-[300px] sm:max-h-[400px] object-contain" />
              </div>
            ) : (
              <div className="border-4 border-dashed border-black rounded-xl p-4 sm:p-8 text-center mb-4 aspect-video flex flex-col items-center justify-center">
                <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 mb-4 opacity-50" />
                <p className="mb-4">Drop your image here or</p>
                <Button
                  variant="outline"
                  className="border-2 border-black rounded-xl font-bold"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" /> Select Image
                </Button>
                <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            )}
          </div>

          {/* Quick tools */}
          {imagePreview && (
            <div className="flex flex-wrap gap-2 mb-6">
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                <Crop className="h-4 w-4 mr-2" /> Crop
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                <RotateCcw className="h-4 w-4 mr-2" /> Rotate
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                <Paintbrush className="h-4 w-4 mr-2" /> Draw
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                <Eraser className="h-4 w-4 mr-2" /> Erase
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                <Layers className="h-4 w-4 mr-2" /> Layers
              </Button>
            </div>
          )}

          {/* Mobile-only controls */}
          <div className="block lg:hidden mb-6">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-black text-white rounded-xl font-bold">
                <span>Image Controls</span>
                <ChevronDown className="h-5 w-5" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-4 p-4 border-2 border-black rounded-xl">
                <div>
                  <Label className="font-bold mb-2 block">Filter</Label>
                  <Select value={activeFilter} onValueChange={setActiveFilter}>
                    <SelectTrigger className="border-2 border-black rounded-xl">
                      <SelectValue placeholder="Select a filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="grayscale">Grayscale</SelectItem>
                      <SelectItem value="sepia">Sepia</SelectItem>
                      <SelectItem value="invert">Invert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-bold mb-2 block">Brightness</Label>
                  <Slider defaultValue={[50]} max={100} step={1} className="py-4" />
                </div>

                <div>
                  <Label className="font-bold mb-2 block">Contrast</Label>
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
            <div className="bg-gradient-to-br from-green-500 to-teal-500 p-4 text-white">
              <h3 className="text-xl font-bold">Image Controls</h3>
            </div>
            <div className="p-4 bg-white">
              <Tabs defaultValue="adjust">
                <TabsList className="bg-white/50 border-2 border-black rounded-xl p-1 mb-4 w-full">
                  <TabsTrigger
                    value="adjust"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Adjust
                  </TabsTrigger>
                  <TabsTrigger
                    value="filters"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Filters
                  </TabsTrigger>
                  <TabsTrigger
                    value="resize"
                    className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                  >
                    Resize
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="adjust" className="space-y-4">
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

                  <div>
                    <Label className="font-bold mb-2 block">Sharpness</Label>
                    <Slider defaultValue={[30]} max={100} step={1} className="py-4" />
                  </div>
                </TabsContent>

                <TabsContent value="filters" className="space-y-4">
                  <div>
                    <Label className="font-bold mb-2 block">Filter</Label>
                    <Select value={activeFilter} onValueChange={setActiveFilter}>
                      <SelectTrigger className="border-2 border-black rounded-xl">
                        <SelectValue placeholder="Select a filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="grayscale">Grayscale</SelectItem>
                        <SelectItem value="sepia">Sepia</SelectItem>
                        <SelectItem value="invert">Invert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Intensity</Label>
                    <Slider defaultValue={[100]} max={100} step={1} className="py-4" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Vignette</Label>
                    <Switch />
                  </div>
                </TabsContent>

                <TabsContent value="resize" className="space-y-4">
                  <div>
                    <Label className="font-bold mb-2 block">Width</Label>
                    <div className="flex items-center gap-2">
                      <Slider defaultValue={[100]} max={200} step={1} className="flex-1 py-4" />
                      <span className="min-w-[40px] text-right">100%</span>
                    </div>
                  </div>

                  <div>
                    <Label className="font-bold mb-2 block">Height</Label>
                    <div className="flex items-center gap-2">
                      <Slider defaultValue={[100]} max={200} step={1} className="flex-1 py-4" />
                      <span className="min-w-[40px] text-right">100%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Lock Aspect Ratio</Label>
                    <Switch defaultChecked />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 space-y-3">
                <Button className="w-full bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold">
                  <Save className="h-4 w-4 mr-2" /> Save Project
                </Button>
                <Button variant="outline" className="w-full border-2 border-black rounded-xl font-bold">
                  <Download className="h-4 w-4 mr-2" /> Export Image
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  )
}
