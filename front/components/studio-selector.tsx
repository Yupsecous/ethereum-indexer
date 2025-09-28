"use client"

import { Card } from "@/components/ui/card"
import { Image, Music, Video, FileText } from "lucide-react"
import Link from "next/link"

export default function StudioSelector() {
  const studioOptions = [
    {
      type: "audio",
      name: "Audio Studio",
      description: "Mix, master, and edit audio content with AI assistance",
      icon: <Music className="h-8 w-8 sm:h-10 sm:w-10" />,
      color: "bg-gradient-to-br from-pink-500 to-orange-500",
      href: "/studio/audio",
    },
    {
      type: "video",
      name: "Video Studio",
      description: "Edit, trim, and enhance video content with AI tools",
      icon: <Video className="h-8 w-8 sm:h-10 sm:w-10" />,
      color: "bg-gradient-to-br from-blue-500 to-purple-500",
      href: "/studio/video",
    },
    {
      type: "image",
      name: "Image Studio",
      description: "Edit and enhance images with AI-powered features",
      icon: <Image className="h-8 w-8 sm:h-10 sm:w-10" />,
      color: "bg-gradient-to-br from-green-500 to-teal-500",
      href: "/studio/image",
    },
    {
      type: "text",
      name: "Text Studio",
      description: "Create and optimize text content with AI assistance",
      icon: <FileText className="h-8 w-8 sm:h-10 sm:w-10" />,
      color: "bg-gradient-to-br from-yellow-500 to-amber-500",
      href: "/studio/text",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {studioOptions.map((studio) => (
        <Link href={studio.href} key={studio.type} className="block">
          <Card className="border-4 border-black rounded-xl overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-[-4px] transition-transform h-full">
            <div className={`p-4 sm:p-6 text-white ${studio.color}`}>
              {studio.icon}
              <h3 className="text-lg sm:text-xl font-bold mt-4">{studio.name}</h3>
            </div>
            <div className="p-4 bg-white">
              <p className="text-sm sm:text-base">{studio.description}</p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
