"use client"

import { useState, useRef, useEffect } from "react"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Subtitles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true)
  const [activeCue, setActiveCue] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateTime = () => setCurrentTime(video.currentTime)
    const updateDuration = () => setDuration(video.duration)

    video.addEventListener("timeupdate", updateTime)
    video.addEventListener("loadedmetadata", updateDuration)

    return () => {
      video.removeEventListener("timeupdate", updateTime)
      video.removeEventListener("loadedmetadata", updateDuration)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTrackLoad = () => {
      const track = video.textTracks[0]
      if (!track) return

      // Always hide native rendering
      track.mode = "hidden"

      const updateCue = () => {
        const active = track.activeCues?.[0] as VTTCue | undefined
        setActiveCue(active?.text ?? null)
      }

      // Ensure track stays hidden even if Chrome changes it
      const enforceHiddenMode = () => {
        if (track.mode !== "hidden") {
          track.mode = "hidden"
        }
      }

      track.addEventListener("cuechange", updateCue)
      track.addEventListener("change", enforceHiddenMode)

      return () => {
        track.removeEventListener("cuechange", updateCue)
        track.removeEventListener("change", enforceHiddenMode)
      }
    }

    // Re-enforce hidden mode after fullscreen changes (browsers may reset tracks)
    const handleFullscreenChange = () => {
      const track = video.textTracks[0]
      if (track) {
        track.mode = "hidden"
      }
    }

    video.addEventListener("loadedmetadata", handleTrackLoad)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      video.removeEventListener("loadedmetadata", handleTrackLoad)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.volume = value[0]
      setVolume(value[0])
      if (value[0] > 0 && isMuted) {
        videoRef.current.muted = false
        setIsMuted(false)
      }
    }
  }

  const toggleSubtitles = () => {
    const video = videoRef.current
    if (video) {
      const track = video.textTracks[0]
      if (track) {
        // Always keep native rendering hidden, only toggle our custom display
        track.mode = "hidden"
      }
    }
    setSubtitlesEnabled(!subtitlesEnabled)
  }

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen()
      }
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="group relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
      <video
        ref={videoRef}
        className="h-full w-full"
        poster="/optimo-logo.svg"
        onClick={togglePlay}
        playsInline
      >
        <source src="/promo-video.mp4" type="video/mp4" />
        <track
          kind="subtitles"
          src="/subtitles-albanian.vtt"
          srcLang="sq"
          label="Albanian"
          default
        />
        Your browser does not support the video tag.
      </video>

      {/* Custom subtitle rendering */}
      {activeCue && subtitlesEnabled && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4">
          <span className="rounded bg-black/80 px-3 py-1 text-center text-sm text-white">
            {activeCue}
          </span>
        </div>
      )}

      {/* YouTube-style overlay controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/60 to-transparent p-4 pt-16 transition-opacity duration-300 ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
      >
        {/* Progress Bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-10 w-10 text-white hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8 text-white hover:bg-white/20"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            <span className="ml-2 text-sm text-white">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSubtitles}
              className={`h-8 w-8 hover:bg-white/20 ${
                subtitlesEnabled ? "text-primary" : "text-white"
              }`}
              title="Toggle Albanian Subtitles"
            >
              <Subtitles className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 text-white hover:bg-white/20"
              title="Fullscreen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
