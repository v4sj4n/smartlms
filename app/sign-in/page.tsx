import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OptimoLogo } from "@/components/optimo-logo"
import { SignInForm } from "./sign-in-form"

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <OptimoLogo className="h-12 w-12 fill-foreground" />
          <span className="font-heading text-2xl font-bold tracking-tight">
            Optimo
          </span>
        </div>
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-2xl font-bold tracking-tight">
              Welcome to OptimoLMS
            </CardTitle>
            <CardDescription>
              Enter your credentials to access the LMS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
          <CardFooter className="flex-col gap-4 text-center text-sm text-muted-foreground">
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
