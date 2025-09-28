"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Instagram, Linkedin, Twitter, Youtube, ImageIcon, Calendar, Send } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"

interface ContentCreatorProps {
  type: "post" | "story" | "video"
}

export default function ContentCreator({ type }: ContentCreatorProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    instagram: true,
    twitter: true,
    linkedin: false,
    youtube: false,
  })

  const togglePlatform = (platform: keyof typeof selectedPlatforms) => {
    setSelectedPlatforms({
      ...selectedPlatforms,
      [platform]: !selectedPlatforms[platform],
    })
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6">
      <Card className="border-4 border-black rounded-xl p-4 sm:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-4">
          <Textarea
            placeholder={`Write your ${type} content here...`}
            className="min-h-[150px] border-2 border-black rounded-xl p-4 text-lg"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button variant="outline" className="border-2 border-black rounded-xl font-bold flex gap-2 h-12">
            <ImageIcon className="h-5 w-5" /> Add Media
          </Button>
          <Button variant="outline" className="border-2 border-black rounded-xl font-bold flex gap-2 h-12">
            <Calendar className="h-5 w-5" /> Schedule
          </Button>
        </div>

        {type === "post" && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Post Settings</h3>
            <Tabs defaultValue="filters">
              <TabsList className="bg-white/50 border-2 border-black rounded-xl p-1 mb-4 w-full">
                <TabsTrigger
                  value="filters"
                  className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                >
                  Filters
                </TabsTrigger>
                <TabsTrigger
                  value="hashtags"
                  className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                >
                  Hashtags
                </TabsTrigger>
                <TabsTrigger
                  value="advanced"
                  className="rounded-lg data-[state=active]:bg-black data-[state=active]:text-white font-bold"
                >
                  Advanced
                </TabsTrigger>
              </TabsList>
              <TabsContent value="filters">
                <div className="space-y-4">
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
                </div>
              </TabsContent>
              <TabsContent value="hashtags">
                <Textarea
                  placeholder="Add hashtags here..."
                  className="min-h-[100px] border-2 border-black rounded-xl p-4"
                />
              </TabsContent>
              <TabsContent value="advanced">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Hide Likes</Label>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Turn Off Comments</Label>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Alt Text</Label>
                    <Switch />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {type === "story" && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Story Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                Add Sticker
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                Add Text
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                Add Music
              </Button>
              <Button variant="outline" className="border-2 border-black rounded-xl font-bold">
                Add Poll
              </Button>
            </div>
          </div>
        )}

        {type === "video" && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Video Settings</h3>
            <div>
              <Label className="font-bold mb-2 block">Thumbnail</Label>
              <div className="border-2 border-dashed border-black rounded-xl p-8 text-center">
                <ImageIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  Drop your thumbnail here or <span className="underline">browse</span>
                </p>
              </div>
            </div>
            <div>
              <Label className="font-bold mb-2 block">Title</Label>
              <Textarea
                placeholder="Add video title..."
                className="min-h-[60px] border-2 border-black rounded-xl p-4"
              />
            </div>
          </div>
        )}

        {/* Mobile-only platforms section */}
        <div className="mt-6 lg:hidden">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-black text-white rounded-xl font-bold">
              <span>Platforms</span>
              <ChevronDown className="h-5 w-5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 p-3 border-2 border-black rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Instagram className="h-5 w-5" />
                  <Label className="font-bold">Instagram</Label>
                </div>
                <Switch checked={selectedPlatforms.instagram} onCheckedChange={() => togglePlatform("instagram")} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Twitter className="h-5 w-5" />
                  <Label className="font-bold">Twitter</Label>
                </div>
                <Switch checked={selectedPlatforms.twitter} onCheckedChange={() => togglePlatform("twitter")} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Linkedin className="h-5 w-5" />
                  <Label className="font-bold">LinkedIn</Label>
                </div>
                <Switch checked={selectedPlatforms.linkedin} onCheckedChange={() => togglePlatform("linkedin")} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Youtube className="h-5 w-5" />
                  <Label className="font-bold">YouTube</Label>
                </div>
                <Switch checked={selectedPlatforms.youtube} onCheckedChange={() => togglePlatform("youtube")} />
              </div>
              <Button className="w-full mt-4 h-12 bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2">
                <Send className="h-5 w-5" /> Publish Now
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Card>

      {/* Desktop-only platforms section */}
      <div className="hidden lg:block space-y-6">
        <Card className="border-4 border-black rounded-xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black text-lg mb-4">PLATFORMS</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="h-5 w-5" />
                <Label className="font-bold">Instagram</Label>
              </div>
              <Switch checked={selectedPlatforms.instagram} onCheckedChange={() => togglePlatform("instagram")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Twitter className="h-5 w-5" />
                <Label className="font-bold">Twitter</Label>
              </div>
              <Switch checked={selectedPlatforms.twitter} onCheckedChange={() => togglePlatform("twitter")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Linkedin className="h-5 w-5" />
                <Label className="font-bold">LinkedIn</Label>
              </div>
              <Switch checked={selectedPlatforms.linkedin} onCheckedChange={() => togglePlatform("linkedin")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className="h-5 w-5" />
                <Label className="font-bold">YouTube</Label>
              </div>
              <Switch checked={selectedPlatforms.youtube} onCheckedChange={() => togglePlatform("youtube")} />
            </div>
          </div>
        </Card>

        <Button className="w-full h-14 bg-black hover:bg-black/80 text-white rounded-xl border-2 border-black font-bold text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2">
          <Send className="h-5 w-5" /> Publish Now
        </Button>
      </div>
    </div>
  )
}
