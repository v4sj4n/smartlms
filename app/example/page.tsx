"use client"

import { useState } from "react"
import {
  Bell,
  Copy,
  LogOut,
  Settings,
  Download,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

// Components
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty } from "@/components/ui/empty"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { InputGroup } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Toaster } from "@/components/ui/sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function ComponentsExample() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [openDialog, setOpenDialog] = useState(false)
  const [slider, setSlider] = useState([33])

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold">Component Showcase</h1>
                <p className="text-muted-foreground">
                  A complete example of all shadcn/ui components
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto space-y-16 px-4 py-12">
          {/* Buttons Section */}
          <Section title="Buttons & Button Group">
            <div className="grid gap-8">
              <div>
                <h3 className="mb-4 font-semibold">Button Variants</h3>
                <div className="flex flex-wrap gap-4">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Button Sizes</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Button Group</h3>
                <ButtonGroup>
                  <Button variant="outline">Left</Button>
                  <Button variant="outline">Middle</Button>
                  <Button variant="outline">Right</Button>
                </ButtonGroup>
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Button with Icons</h3>
                <div className="flex flex-wrap gap-4">
                  <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add New
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* Input Fields Section */}
          <Section title="Input Fields">
            <div className="grid max-w-md gap-6">
              <div className="space-y-2">
                <Label htmlFor="input-default">Default Input</Label>
                <Input id="input-default" placeholder="Enter text..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-with-icon">Input with Icon</Label>
                <InputGroup>
                  <Input id="input-with-icon" placeholder="Search..." />
                </InputGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="textarea">Textarea</Label>
                <Textarea
                  id="textarea"
                  placeholder="Enter your message..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="select">Select</Label>
                <Select>
                  <SelectTrigger id="select">
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                    <SelectItem value="option3">Option 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* Checkboxes & Radio Buttons */}
          <Section title="Checkboxes & Radio Buttons">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold">Checkboxes</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="check1" />
                    <Label htmlFor="check1" className="cursor-pointer">
                      Option 1
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="check2" />
                    <Label htmlFor="check2" className="cursor-pointer">
                      Option 2
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="check3" disabled />
                    <Label
                      htmlFor="check3"
                      className="cursor-pointer opacity-50"
                    >
                      Disabled
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Radio Buttons</h3>
                <RadioGroup defaultValue="option1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option1" id="radio1" />
                    <Label htmlFor="radio1" className="cursor-pointer">
                      Option 1
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option2" id="radio2" />
                    <Label htmlFor="radio2" className="cursor-pointer">
                      Option 2
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="option3" id="radio3" />
                    <Label htmlFor="radio3" className="cursor-pointer">
                      Option 3
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </Section>

          {/* Badges */}
          <Section title="Badges">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Default</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </div>
            </div>
          </Section>

          {/* Cards */}
          <Section title="Cards">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>Card description goes here</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>This is a basic card component example.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>✓ Feature one</li>
                    <li>✓ Feature two</li>
                    <li>✓ Feature three</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Stats</span>
                    <Badge>Active</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">42</p>
                  <p className="text-xs text-muted-foreground">Total items</p>
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* Avatar */}
          <Section title="Avatar">
            <div className="flex gap-4">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarImage src="https://github.com/vercel.png" />
                <AvatarFallback>VL</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
            </div>
          </Section>

          {/* Alerts */}
          <Section title="Alerts">
            <div className="max-w-2xl space-y-4">
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>
                  This is an informational alert message.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <Bell className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  This is an error alert message.
                </AlertDescription>
              </Alert>
            </div>
          </Section>

          {/* Toggle & Switch */}
          <Section title="Toggle & Switch">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-semibold">Toggle</h3>
                <div className="flex gap-2">
                  <Toggle aria-label="Toggle italic">B</Toggle>
                  <Toggle aria-label="Toggle italic">I</Toggle>
                  <Toggle aria-label="Toggle italic">U</Toggle>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Toggle Group</h3>
                <ToggleGroup type="single" defaultValue="left">
                  <ToggleGroupItem value="left">Left</ToggleGroupItem>
                  <ToggleGroupItem value="center">Center</ToggleGroupItem>
                  <ToggleGroupItem value="right">Right</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="font-semibold">Switch</h3>
              <div className="flex items-center gap-2">
                <Switch id="switch" />
                <Label htmlFor="switch">Toggle feature</Label>
              </div>
            </div>
          </Section>

          {/* Progress & Slider */}
          <Section title="Progress & Slider">
            <div className="max-w-md space-y-8">
              <div>
                <h3 className="mb-4 font-semibold">Progress Bar</h3>
                <Progress value={33} className="w-full" />
              </div>

              <div>
                <h3 className="mb-4 font-semibold">Slider</h3>
                <Slider
                  value={slider}
                  onValueChange={setSlider}
                  className="w-full"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Value: {slider[0]}
                </p>
              </div>
            </div>
          </Section>

          {/* Accordion */}
          <Section title="Accordion">
            <div className="max-w-2xl">
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>Is it accessible?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It adheres to the WAI-ARIA design pattern.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Is it styled?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It comes with default styles you can customize.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Is it animated?</AccordionTrigger>
                  <AccordionContent>
                    Yes. It is animated by default, but you can disable it.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Section>

          {/* Tabs */}
          <Section title="Tabs">
            <div className="max-w-2xl">
              <Tabs defaultValue="tab1" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                  <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                  <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tab 1 Content</CardTitle>
                    </CardHeader>
                    <CardContent>This is the content for tab 1.</CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="tab2" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tab 2 Content</CardTitle>
                    </CardHeader>
                    <CardContent>This is the content for tab 2.</CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="tab3" className="mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tab 3 Content</CardTitle>
                    </CardHeader>
                    <CardContent>This is the content for tab 3.</CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </Section>

          {/* Breadcrumb */}
          <Section title="Breadcrumb">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/components">Components</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </Section>

          {/* Pagination */}
          <Section title="Pagination">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">1</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#" isActive>
                    2
                  </PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink href="#">3</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </Section>

          {/* Dialogs & Alerts */}
          <Section title="Dialogs & Alerts">
            <div className="flex flex-wrap gap-4">
              <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild>
                  <Button>Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog Title</DialogTitle>
                    <DialogDescription>
                      This is a dialog component. You can put any content here.
                    </DialogDescription>
                  </DialogHeader>
                  <Button onClick={() => setOpenDialog(false)}>Close</Button>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Item</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex justify-end gap-4">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Delete</AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button variant="outline">Open Drawer</Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Drawer Title</DrawerTitle>
                    <DrawerDescription>
                      This is a drawer component.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="p-4">
                    <p>Drawer content goes here.</p>
                  </div>
                  <DrawerClose asChild>
                    <Button variant="outline">Close</Button>
                  </DrawerClose>
                </DrawerContent>
              </Drawer>
            </div>
          </Section>

          {/* Dropdown Menu */}
          <Section title="Dropdown Menu">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Open Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Section>

          {/* Popover & Hover Card */}
          <Section title="Popover & Hover Card">
            <div className="flex gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Open Popover</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="space-y-2">
                    <h4 className="font-medium">Popover Title</h4>
                    <p className="text-sm text-muted-foreground">
                      This is popover content.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>

              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="outline">Hover Me</Button>
                </HoverCardTrigger>
                <HoverCardContent>
                  <div className="space-y-2">
                    <h4 className="font-medium">Hover Card</h4>
                    <p className="text-sm">This card appears on hover.</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          </Section>

          {/* Tooltip */}
          <Section title="Tooltip">
            <TooltipProvider>
              <div className="flex gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline">Hover for Tooltip</Button>
                  </TooltipTrigger>
                  <TooltipContent>This is a tooltip</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </Section>

          {/* Sheet */}
          <Section title="Sheet">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Sheet Title</SheetTitle>
                  <SheetDescription>
                    Sheet description goes here.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                  <p>Sheet content goes here.</p>
                </div>
              </SheetContent>
            </Sheet>
          </Section>

          {/* Spinner */}
          <Section title="Spinner">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Spinner />
                <span>Loading...</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner />
                <span>Loading (small)</span>
              </div>
              <div className="flex items-center gap-2">
                <Spinner />
                <span>Loading (large)</span>
              </div>
            </div>
          </Section>

          {/* Skeleton */}
          <Section title="Skeleton">
            <div className="space-y-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Section>

          {/* Table */}
          <Section title="Table">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>John Doe</TableCell>
                    <TableCell>john@example.com</TableCell>
                    <TableCell>
                      <Badge>Active</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Jane Smith</TableCell>
                    <TableCell>jane@example.com</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Pending</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Section>

          {/* Kbd */}
          <Section title="Keyboard">
            <div className="flex flex-wrap gap-2">
              <Kbd>Ctrl</Kbd>
              <span>+</span>
              <Kbd>K</Kbd>
            </div>
          </Section>

          {/* Calendar */}
          <Section title="Calendar">
            <div className="flex w-fit justify-center rounded-lg border p-4">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </div>
          </Section>

          {/* Carousel */}
          <Section title="Carousel">
            <div className="max-w-2xl">
              <Carousel>
                <CarouselContent>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <CarouselItem key={i} className="md:basis-1/2">
                      <div className="p-1">
                        <Card className="flex h-64 items-center justify-center">
                          <CardContent className="text-6xl font-bold">
                            {i}
                          </CardContent>
                        </Card>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
          </Section>

          {/* Resizable */}
          <Section title="Resizable Panels">
            <div className="h-64 overflow-hidden rounded-lg border">
              <ResizablePanelGroup>
                <ResizablePanel defaultSize={50}>
                  <div className="flex h-full items-center justify-center bg-muted">
                    <p>Left Panel</p>
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={50}>
                  <div className="flex h-full items-center justify-center bg-background">
                    <p>Right Panel</p>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </Section>

          {/* Scroll Area */}
          <Section title="Scroll Area">
            <div className="overflow-hidden rounded-lg border">
              <ScrollArea className="h-64 w-full">
                <div className="p-4">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="mb-4 border-b pb-4 last:border-0">
                      <h4 className="font-medium">Item {i + 1}</h4>
                      <p className="text-sm text-muted-foreground">
                        This is scrollable content item number {i + 1}.
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </Section>

          {/* Empty State */}
          <Section title="Empty State">
            <Empty title="No items found">
              <Button>Create Item</Button>
            </Empty>
          </Section>

          {/* Sonner Toast */}
          <Section title="Sonner Toast Notifications">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => toast.success("Success! Operation completed.")}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Success Toast
              </Button>
              <Button
                onClick={() => toast.error("Error! Something went wrong.")}
                variant="destructive"
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Error Toast
              </Button>
              <Button
                onClick={() => toast.warning("Warning! Please review this.")}
                variant="secondary"
                className="gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Warning Toast
              </Button>
              <Button
                onClick={() => toast.info("Info! Here's some information.")}
                variant="outline"
                className="gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Info Toast
              </Button>
              <Button
                onClick={() => toast.loading("Loading...")}
                variant="outline"
                className="gap-2"
              >
                Loading Toast
              </Button>
              <Button
                onClick={() =>
                  toast("Custom Toast", {
                    description: "This is a custom toast with a description.",
                  })
                }
                variant="outline"
                className="gap-2"
              >
                Custom Toast
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

// Helper Section Component
function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <Separator className="mt-2" />
      </div>
      <div>{children}</div>
    </div>
  )
}
