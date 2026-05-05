import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SignInForm } from "./sign-in-form"

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
            <SignInForm />
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
