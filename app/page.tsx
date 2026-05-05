import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"

export default function Page() {
  const navLinkClass =
    "group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-primary-foreground/20 hover:text-primary-foreground focus:bg-primary-foreground/20 focus:text-primary-foreground focus:outline-none data-[active]:bg-primary-foreground/20 data-[state=open]:bg-primary-foreground/20"

  return (
    <main className="relative flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-heading text-xl font-bold tracking-tight">
                SmartLMS
              </span>
            </Link>

            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/" legacyBehavior passHref>
                    <NavigationMenuLink className={navLinkClass}>
                      Home
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link href="#about" legacyBehavior passHref>
                    <NavigationMenuLink className={navLinkClass}>
                      About
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <Link href="#features" legacyBehavior passHref>
                    <NavigationMenuLink className={navLinkClass}>
                      Features
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
      </header>

      {/* Modern Hero Section */}
      <section className="flex flex-1 flex-col bg-linear-to-br from-background via-muted/30 to-muted">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-24 md:px-8 md:py-32 lg:py-40">
          <div className="flex flex-col gap-4">
            <div className="inline-flex w-fit items-center rounded-full border bg-secondary/50 px-3 py-1 text-sm font-medium text-secondary-foreground">
              🚀 Welcome to the Future of Learning
            </div>

            <h1 className="max-w-4xl font-heading text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              Modern learning, <br className="hidden sm:inline" />
              <span className="text-muted-foreground">all in one place.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              A seamless workspace where classes, assignments, and progress come
              together to make education easier and more engaging for everyone.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base font-semibold"
            >
              <Link href="/vidshpjeguese.mp4" target="_blank">
                Watch Demo
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base font-semibold"
            >
              <Link href="/sign-in">Go to LMS</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
