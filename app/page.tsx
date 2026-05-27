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
  Play,
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
    title: "Learning Hub",
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

export default function Page() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground selection:bg-primary/10">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32 md:pt-32 md:pb-40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center md:px-8">
          <h1
            className="reveal-in max-w-4xl font-heading text-5xl font-bold tracking-tight text-balance sm:text-6xl md:text-7xl"
            style={{ animationDelay: "0ms" }}
          >
            Modern learning, <br className="hidden sm:inline" />
            <span className="text-muted-foreground">all in one place.</span>
          </h1>

          <p
            className="reveal-in mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl"
            style={{ animationDelay: "90ms" }}
          >
            A seamless workspace where classes, assignments, and progress come
            together to make education easier, smarter, and more engaging.
          </p>

          <div
            className="reveal-in mt-10 flex flex-wrap justify-center gap-4"
            style={{ animationDelay: "180ms" }}
          >
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <Link href="/sign-in">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="group h-12 pr-7.5 pl-8 text-base transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <Link href="/vidshpjeguese.mp4" target="_blank">
                <Play className="mr-2 ml-px h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                Watch Demo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full bg-muted/30 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="mb-16 flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              A comprehensive suite of tools designed specifically to streamline
              your academic experience and reduce administrative friction.
            </p>
          </div>

          <div className="relative px-10">
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
              <CarouselContent>
                {features.map((feature, index) => (
                  <CarouselItem
                    key={index}
                    className="sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                  >
                    <div
                      className="surface-elevated reveal-in group relative flex h-full flex-col gap-4 rounded-2xl bg-background p-6"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="mb-2 font-semibold text-balance">
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
              <CarouselPrevious className="size-11" />
              <CarouselNext className="size-11" />
            </Carousel>
          </div>
        </div>
      </section>

      {/* Q&A Section */}
      <section id="qa" className="w-full py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <div className="mb-12 flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
              Common Questions
            </h2>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Everything you need to know before getting started with Optimo.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-base font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="w-full bg-muted/30 py-24 md:py-32">
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <div className="mb-12 flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
              Designed for the future
            </h2>
            <p className="text-lg text-pretty text-muted-foreground">
              We believe a learning platform should clear a path for the mind,
              not clutter it.
            </p>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold">The Conception</h3>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                Optimo was born out of a desire to redefine how technology
                integrates with modern education. Recognizing that the digital
                environment directly impacts cognitive focus, we designed a
                platform where technology acts as an accelerator rather than an
                administrative hurdle.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold">
                Minimalism &amp; Intelligence
              </h3>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                Every feature exists for a reason, engineered to reduce
                cognitive load. Optimo intelligently handles data, optimizing
                layouts and tasks behind the scenes. It&apos;s an ecosystem
                built to empower both structural organization and the freedom of
                creative workflow.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-xl font-semibold">The Visionaries</h3>
              <p className="leading-relaxed text-pretty text-muted-foreground">
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
