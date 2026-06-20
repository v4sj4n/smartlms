import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/navbar"

export const metadata: Metadata = {
  title: "OptimoLMS",
  description:
    "A seamless workspace where classes, assignments, and progress come together to make education easier, smarter, and more engaging.",
}

import {
  Brain,
  Target,
  BookOpen,
  Users,
  Calendar,
  MessageSquare,
  TrendingUp,
  Layout,
  ArrowRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const features = [
  {
    icon: BookOpen,
    title: "Academic Hub",
    description:
      "A unified center for courses, materials, assignments, and learning resources.",
  },
  {
    icon: Brain,
    title: "AI Quizzes",
    description:
      "Automatic quiz generation from lectures to test your knowledge in real-time.",
  },
  {
    icon: Calendar,
    title: "Smart Calendar",
    description:
      "Automatic management of deadlines, exams, and academic events.",
  },
  {
    icon: TrendingUp,
    title: "Progress Analytics",
    description:
      "Clear analysis of performance and academic progress to help you improve.",
  },
  {
    icon: Target,
    title: "Personalized Seminars",
    description:
      "Intelligent recommendations based on your interests and academic progress.",
  },
  {
    icon: MessageSquare,
    title: "Collaboration Spaces",
    description:
      "Environments for group projects, communication, and idea exchange.",
  },
  {
    icon: Users,
    title: "Social Life & Clubs",
    description:
      "Connect with clubs, organizations, and university activities effortlessly.",
  },
  {
    icon: Layout,
    title: "Effortless Experience",
    description:
      "A minimalist, intuitive interface where everything is just a few clicks away.",
  },
]

const faqs = [
  {
    question: "What is Optimo?",
    answer:
      "Optimo is a modern Learning Management System designed for universities. It brings together courses, assignments, AI-powered tools, and collaboration features in one seamless interface — built to make education simpler and smarter.",
  },
  {
    question: "Who is Optimo designed for?",
    answer:
      "Optimo is built for students, professors, and academic administrators. Each role gets a tailored experience — from accessing course materials and tracking progress, to managing enrollments and monitoring academic performance.",
  },
  {
    question: "How does the AI quiz feature work?",
    answer:
      "Professors upload course materials, and Optimo's AI engine automatically generates quiz questions based on the content. Students can then practice and test their knowledge in real-time, reinforcing learning without extra effort from instructors.",
  },
  {
    question: "Is Optimo available on mobile devices?",
    answer:
      "Yes. Optimo is fully responsive and works seamlessly across all devices — desktop, tablet, and mobile. You can access your courses, calendar, and collaboration spaces from anywhere.",
  },
  {
    question: "How do I get access to Optimo?",
    answer:
      "Access is provided through your institution. Once your university has onboarded Optimo, you will receive credentials to sign in and start using your personalized academic dashboard immediately.",
  },
]

function WorkspaceCollage() {
  return (
    <div className="relative w-full max-w-sm scale-[0.9] pb-2 transition-transform duration-300 will-change-transform select-none sm:max-w-md sm:scale-100 sm:pb-10 md:max-w-lg lg:max-w-xl">
      {/* Background glow behind collage - outer radius 40px, inner cards 24px (p-4=16px, 40-16=24) */}
      <div className="absolute inset-4 rounded-[40px] bg-gradient-to-tr from-primary/10 via-secondary/15 to-accent/10 opacity-80 blur-3xl" />

      {/* Symmetrical Staggered Columns */}
      <div className="relative z-10 grid w-full grid-cols-2 gap-4 md:gap-6">
        {/* Left Column */}
        <div className="space-y-4 md:space-y-6">
          {/* Card 1: AI Assistant - outer radius 24px, inner elements 8px */}
          <div className="rounded-3xl bg-card p-4 shadow-lg transition-[box-shadow,transform] duration-300 ease-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                  <Brain className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-bold tracking-tight text-foreground">
                  AI Quizzes
                </span>
              </div>
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            </div>
            <div className="space-y-2">
              <div className="truncate rounded-lg bg-background/60 p-2 font-mono text-[10px] text-muted-foreground">
                Lecture-4-Complexity.pdf
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Generating questions</span>
                <span className="font-semibold">70%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-primary to-secondary" />
              </div>
            </div>
          </div>

          {/* Card 4: Upcoming Tasks - outer radius 24px */}
          <div className="rounded-3xl bg-card p-4 shadow-lg transition-[box-shadow,transform] duration-300 ease-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-border/10 pb-2">
              <span className="text-[11px] font-bold text-foreground">
                Upcoming Tasks
              </span>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="truncate text-[10px] text-muted-foreground">
                    Complexity Quiz
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-amber-600">
                  1d left
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="truncate text-[10px] text-muted-foreground">
                    Seminar Project
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold text-primary">
                  Friday
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Staggered Downward) */}
        <div className="translate-y-6 space-y-4 md:translate-y-10 md:space-y-6">
          {/* Card 2: Course Card - outer radius 24px */}
          <div className="rounded-3xl bg-card p-4 shadow-lg transition-[box-shadow,transform] duration-300 ease-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                CS-101
              </span>
              <BookOpen className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <h4 className="mb-1 text-[12px] font-bold text-foreground">
              Intro to Computer Science
            </h4>
            <p className="mb-3 text-[10px] leading-relaxed text-muted-foreground">
              Active discussion: 4 new questions from classmates.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[7px] font-bold">
                  JD
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/20 text-[7px] font-bold">
                  AM
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[7px] font-bold">
                  FL
                </div>
              </div>
              <span className="text-[9px] font-medium text-muted-foreground">
                12 classmates
              </span>
            </div>
          </div>

          {/* Card 3: Analytics Progress - outer radius 24px, tabular numbers */}
          <div className="rounded-3xl bg-card p-4 shadow-lg transition-[box-shadow,transform] duration-300 ease-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground">
                Study Analytics
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="mb-2 flex items-end gap-2">
              <span className="font-mono text-2xl leading-none font-bold tracking-tight text-foreground tabular-nums">
                94%
              </span>
              <span className="text-[9px] text-muted-foreground">
                Global GPA
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
              <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-primary to-secondary" />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Weekly target met</span>
              <span className="font-mono font-semibold text-emerald-500 tabular-nums">
                +12%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground selection:bg-primary/10">
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex min-h-[calc(100svh-4rem)] w-full items-center overflow-hidden bg-background py-8 sm:py-12 lg:py-0">
        {/* Background Blobs & Gradients */}
        <div
          className="absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          {/* Blob 1: Top Right */}
          <div className="absolute -top-[25%] -right-[15%] h-[65%] w-[65%] rounded-full bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent blur-[160px] md:blur-[180px]" />
          {/* Blob 2: Bottom Left */}
          <div className="absolute -bottom-[25%] -left-[15%] h-[55%] w-[55%] rounded-full bg-gradient-to-tr from-accent/20 via-primary/10 to-transparent blur-[160px] md:blur-[180px]" />
          {/* Blob 3: Center Light Glow */}
          <div className="absolute top-[25%] left-[20%] h-[45%] w-[45%] rounded-full bg-gradient-to-r from-secondary/5 to-accent/10 opacity-70 blur-[160px] dark:opacity-55" />
          {/* Blob 4: Mid Right */}
          <div className="absolute top-[40%] -right-[5%] h-[35%] w-[35%] rounded-full bg-gradient-to-l from-primary/10 via-accent/15 to-transparent blur-[160px]" />
          {/* Blob 5: Bottom Right */}
          <div className="absolute right-[20%] bottom-[5%] h-[30%] w-[30%] rounded-full bg-gradient-to-tr from-secondary/10 to-transparent blur-[160px]" />
        </div>

        <div className="z-10 mx-auto w-full max-w-6xl px-6 md:px-8">
          <div className="grid w-full grid-cols-1 items-center gap-8 sm:gap-10 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Text & Actions */}
            <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:col-span-5 lg:items-start lg:text-left">
              <h1
                className="reveal-in font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-6xl"
                style={{ animationDelay: "0ms" }}
              >
                Modern learning, <br />
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent dark:from-foreground dark:to-primary">
                  all in one place.
                </span>
              </h1>

              <p
                className="reveal-in mt-6 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
                style={{ animationDelay: "90ms" }}
              >
                A seamless workspace where classes, assignments, and progress
                come together to make education easier, smarter, and more
                engaging.
              </p>

              <div
                className="reveal-in mt-8 flex flex-wrap justify-center gap-4 lg:justify-start"
                style={{ animationDelay: "180ms" }}
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-8 text-base shadow-sm shadow-primary/20 transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  <Link href="/sign-in">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column: Interactive CSS Collage Graphic — first on mobile */}
            <div
              className="reveal-in order-1 flex w-full justify-center lg:order-2 lg:col-span-7 lg:justify-end"
              style={{ animationDelay: "270ms" }}
            >
              <WorkspaceCollage />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="w-full bg-muted/30 py-16 sm:py-24 md:py-32"
      >
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="mb-10 flex flex-col items-center gap-3 text-center sm:mb-16 sm:gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl md:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
              A comprehensive suite of tools designed specifically to streamline
              your academic experience and reduce administrative friction.
            </p>
          </div>

          <div className="relative px-2 sm:px-10">
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent className="-ml-3 sm:-ml-4">
                {features.map((feature, index) => (
                  <CarouselItem
                    key={index}
                    className="basis-[85%] pl-3 sm:basis-1/2 sm:pl-4 lg:basis-1/3 xl:basis-1/4"
                  >
                    <div
                      className="reveal-in group relative flex h-full flex-col gap-4 rounded-2xl bg-background p-5 transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-1 hover:shadow-xl sm:gap-5 sm:rounded-3xl sm:p-6"
                      style={{
                        animationDelay: `${index * 70}ms`,
                        boxShadow: `
                          0px 0px 0px 1px rgba(0, 0, 0, 0.04),
                          0px 1px 2px -1px rgba(0, 0, 0, 0.04),
                          0px 2px 4px 0px rgba(0, 0, 0, 0.02)
                        `,
                      }}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-[background-color,color,transform,box-shadow] duration-300 ease-out group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg sm:h-14 sm:w-14 sm:rounded-2xl">
                        <feature.icon className="h-6 w-6 transition-transform duration-300 ease-out group-hover:scale-110 sm:h-7 sm:w-7" />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:gap-2">
                        <h3 className="text-base leading-tight font-semibold text-balance sm:text-lg">
                          {feature.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-1 size-11 shadow-md transition-transform active:scale-[0.96] sm:-left-12 sm:shadow-none" />
              <CarouselNext className="right-1 size-11 shadow-md transition-transform active:scale-[0.96] sm:-right-12 sm:shadow-none" />
            </Carousel>
          </div>
        </div>
      </section>

      {/* Q&A Section */}
      <section id="qa" className="w-full py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <div className="mb-8 flex flex-col items-center gap-3 text-center sm:mb-12 sm:gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl md:text-4xl">
              Common Questions
            </h2>
            <p className="max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
              Everything you need to know before getting started with Optimo.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-border/60"
              >
                <AccordionTrigger className="py-4 text-left text-sm font-medium hover:no-underline sm:py-5 sm:text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-pretty text-muted-foreground sm:pb-5 sm:text-base">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        className="w-full bg-muted/30 py-16 sm:py-24 md:py-32"
      >
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <div className="mb-8 flex flex-col items-center gap-3 text-center sm:mb-12 sm:gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl md:text-4xl">
              Designed for the future
            </h2>
            <p className="text-base text-pretty text-muted-foreground sm:text-lg">
              We believe a learning platform should clear a path for the mind,
              not clutter it.
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:gap-10">
            <div className="flex flex-col gap-2 sm:gap-3">
              <h3 className="text-lg font-semibold text-balance sm:text-xl">
                The Conception
              </h3>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                Optimo was born out of a desire to redefine how technology
                integrates with modern education. Recognizing that the digital
                environment directly impacts cognitive focus, we designed a
                platform where technology acts as an accelerator rather than an
                administrative hurdle.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:gap-3">
              <h3 className="text-lg font-semibold text-balance sm:text-xl">
                Minimalism &amp; Intelligence
              </h3>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                Every feature exists for a reason, engineered to reduce
                cognitive load. Optimo intelligently handles data, optimizing
                layouts and tasks behind the scenes. It&apos;s an ecosystem
                built to empower both structural organization and the freedom of
                creative workflow.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:gap-3">
              <h3 className="text-lg font-semibold text-balance sm:text-xl">
                The Visionaries
              </h3>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                Founded by Vasjan Çupri and Fjona Danglli, Optimo bridges the
                gap between complex full-stack logic and intuitive, user-centric
                design. It represents their shared commitment to building a
                forward-thinking educational ecosystem designed by students, for
                the future of learning.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
