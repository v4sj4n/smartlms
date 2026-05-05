import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-2xl font-bold tracking-tight">
              Welcome back
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your courses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="fjona@smartlms.com"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="12345678"
                    required
                  />
                  <Link
                    href="#"
                    className="inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Button type="submit" className="mt-2 w-full">
                  Login
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-4 text-center text-sm text-muted-foreground">
            <div>
              Don&apos;t have an account?{" "}
              <Link
                href="#"
                className="underline underline-offset-4 hover:text-primary"
              >
                Sign up
              </Link>
            </div>
            <div className="text-xs">
              <Link href="/" className="transition-colors hover:text-primary">
                &larr; Back to Home
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
