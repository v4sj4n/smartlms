"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  getDefaultModelsForProvider,
  getProviderRegistryEntry,
  getSupportedProvidersForModelType,
} from "@/lib/ai/provider-registry"
import type { AISettings } from "@/lib/data/ai-settings"
import {
  FilterIcon,
  Loader2,
  MoreHorizontal,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import {
  createAIModelAction,
  deleteAIModelAction,
  setAIProviderStatusAction,
  setAIModelEnabledAction,
  updateAIModelAction,
  updateEmbeddingRoutingAction,
  updateTextRoutingAction,
  type AIAdminActionResult,
} from "./actions"
import type {
  AIAdminModelRow,
  AIAdminPageData,
  AIProviderCatalogItem,
} from "./data"
import {
  aiConfigSectionSchema,
  aiModelFormSchema,
  type AIConfigSectionValues,
  type AIModelFormValues,
  type ProviderId,
} from "./schemas"

type AISettingsClientProps = AIAdminPageData

type ModelDialogState = {
  open: boolean
  model: AIAdminModelRow | null
  defaultProviderId: ProviderId
}

const SECTION_LABELS = {
  text: "Text Generation",
  embedding: "Embedding Generation",
} as const

function getModelDefaults(
  model: AIAdminModelRow | null,
  defaultProviderId: ProviderId
): AIModelFormValues {
  return {
    id: model?.id,
    providerId: (model?.providerId ?? defaultProviderId) as ProviderId,
    modelName: model?.modelName ?? "",
    modelIdentifier: model?.modelIdentifier ?? "",
    modelType: model?.modelType ?? "text",
    enabled: model?.enabled ?? true,
  }
}

function getConfigDefaults(
  settings: AISettings | null,
  section: "text" | "embedding"
): AIConfigSectionValues {
  if (section === "text") {
    return {
      providerId: (settings?.chatProvider ?? "google") as ProviderId,
      modelId: settings?.chatModelId ?? "gemini-2.0-flash-001",
      apiKey: settings?.chatApiKey ?? "",
      baseUrl: settings?.chatBaseUrl ?? "",
    }
  }

  return {
    providerId: (settings?.embeddingProvider ?? "google") as ProviderId,
    modelId: settings?.embeddingModelId ?? "gemini-embedding-001",
    apiKey: settings?.embeddingApiKey ?? "",
    baseUrl: settings?.embeddingBaseUrl ?? "",
  }
}

function getProviderMap(providers: AIProviderCatalogItem[]) {
  return new Map(providers.map((provider) => [provider.id, provider] as const))
}

export function AISettingsClient({
  settings,
  providers,
  models,
}: AISettingsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"providers" | "models" | "config">(
    "providers"
  )
  const [search, setSearch] = useState("")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([])
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [dialogState, setDialogState] = useState<ModelDialogState>({
    open: false,
    model: null,
    defaultProviderId: (providers[0]?.id ?? "openai") as ProviderId,
  })
  const [deleteTarget, setDeleteTarget] = useState<AIAdminModelRow | null>(null)
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null)
  const [pendingProviderStatusId, setPendingProviderStatusId] = useState<
    string | null
  >(null)

  const providerMap = getProviderMap(providers)
  const normalizedSearch = search.trim().toLowerCase()

  const filteredModels = models.filter((model) => {
    const matchesSearch =
      !normalizedSearch ||
      model.modelName.toLowerCase().includes(normalizedSearch) ||
      model.modelIdentifier.toLowerCase().includes(normalizedSearch)
    const matchesProvider =
      providerFilter === "all" || model.providerId === providerFilter

    return matchesSearch && matchesProvider
  })

  function openAddDialog(providerId?: ProviderId) {
    setDialogState({
      open: true,
      model: null,
      defaultProviderId: (providerId ??
        providers[0]?.id ??
        "openai") as ProviderId,
    })
  }

  async function handleToggle(model: AIAdminModelRow, enabled: boolean) {
    setPendingToggleId(model.id)
    const result = await setAIModelEnabledAction({ id: model.id, enabled })
    setPendingToggleId(null)
    notifyResult(result)
    if (result.success) {
      router.refresh()
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return
    }

    const result = await deleteAIModelAction({ id: deleteTarget.id })
    setDeleteTarget(null)
    notifyResult(result)
    if (result.success) {
      router.refresh()
    }
  }

  async function handleProviderStatusChange(
    provider: AIProviderCatalogItem,
    status: "enabled" | "disabled"
  ) {
    if (provider.status === status) {
      return
    }

    setPendingProviderStatusId(provider.id)
    const result = await setAIProviderStatusAction({ id: provider.id, status })
    setPendingProviderStatusId(null)
    notifyResult(result)

    if (result.success) {
      router.refresh()
    }
  }

  function toggleProviderSelected(providerId: string) {
    setSelectedProviderIds((current) =>
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId]
    )
  }

  function toggleModelSelected(modelId: string) {
    setSelectedModelIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
            Admin AI settings
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Model catalog and routing
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage provider-backed models, inspect provider state, and route
            chat or embedding traffic to the right model.
          </p>
        </div>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "providers" | "models" | "config")
        }
        className="gap-4"
      >
        <TabsList className="h-10 rounded-full border border-border/70 bg-background/90 p-1 shadow-sm">
          <TabsTrigger
            value="providers"
            className="h-8 rounded-full px-4 text-xs"
          >
            Providers
          </TabsTrigger>
          <TabsTrigger value="models" className="h-8 rounded-full px-4 text-xs">
            Models
          </TabsTrigger>
          <TabsTrigger value="config" className="h-8 rounded-full px-4 text-xs">
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          <Card className="rounded-3xl border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base tracking-tight">
                    Providers
                  </CardTitle>
                  <CardDescription>
                    Manage provider status and local flags stored in the
                    database.
                  </CardDescription>
                </div>

                <Badge
                  variant="outline"
                  className="h-9 rounded-full px-3 text-xs"
                >
                  {providers.length} provider{providers.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              <div className="overflow-hidden rounded-b-3xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[8%] px-4 py-3">
                        <span className="sr-only">Select provider</span>
                      </TableHead>
                      <TableHead className="w-[36%] px-4 py-3">
                        Provider
                      </TableHead>
                      <TableHead className="w-[28%] px-4 py-3">
                        Status
                      </TableHead>
                      <TableHead className="w-[28%] px-4 py-3">Local</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          No providers available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      providers.map((provider) => (
                        <TableRow
                          key={provider.id}
                          data-state={
                            selectedProviderIds.includes(provider.id)
                              ? "selected"
                              : "unselected"
                          }
                          className="cursor-pointer"
                          onClick={() => toggleProviderSelected(provider.id)}
                        >
                          <TableCell className="px-4 py-3">
                            <Checkbox
                              checked={selectedProviderIds.includes(
                                provider.id
                              )}
                              onCheckedChange={() =>
                                toggleProviderSelected(provider.id)
                              }
                              aria-label={`Select ${provider.name}`}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="space-y-0.5">
                              <p className="truncate text-xs font-medium text-foreground">
                                {provider.name}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {provider.id}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div
                              className="flex items-center gap-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Switch
                                checked={provider.status === "enabled"}
                                disabled={
                                  pendingProviderStatusId === provider.id
                                }
                                onCheckedChange={(checked) =>
                                  void handleProviderStatusChange(
                                    provider,
                                    checked ? "enabled" : "disabled"
                                  )
                                }
                              />
                              <span className="text-[11px] text-muted-foreground">
                                {provider.status === "enabled"
                                  ? "Enabled"
                                  : "Disabled"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge
                              variant={provider.local ? "secondary" : "outline"}
                              className="h-5 rounded-full px-1.5 text-[11px]"
                            >
                              {provider.local ? "True" : "False"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card className="rounded-3xl border-border/70 bg-background/90 shadow-sm">
            <CardHeader className="gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base tracking-tight">
                    Models
                  </CardTitle>
                  <CardDescription>
                    Search and manage custom provider models.
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  className="h-9 px-3 text-xs"
                  onClick={() => openAddDialog()}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add model
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search models"
                      className="h-9 rounded-xl pl-8 text-xs"
                    />
                  </div>

                  <Select
                    value={providerFilter}
                    onValueChange={setProviderFilter}
                  >
                    <SelectTrigger className="h-9 w-44 rounded-xl text-xs">
                      <FilterIcon className="h-3.5 w-3.5" />
                      <SelectValue placeholder="Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All providers</SelectItem>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Badge
                  variant="outline"
                  className="h-9 rounded-full px-3 text-xs"
                >
                  {filteredModels.length} model
                  {filteredModels.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              <div className="overflow-hidden rounded-b-3xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[6%] px-4 py-3">
                        <span className="sr-only">Select model</span>
                      </TableHead>
                      <TableHead className="w-[24%] px-4 py-3">Name</TableHead>
                      <TableHead className="w-[24%] px-4 py-3">
                        Identifier
                      </TableHead>
                      <TableHead className="w-[12%] px-4 py-3">Type</TableHead>
                      <TableHead className="w-[16%] px-4 py-3">
                        Provider
                      </TableHead>
                      <TableHead className="w-[14%] px-4 py-3">
                        Status
                      </TableHead>
                      <TableHead className="w-[14%] px-4 py-3 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModels.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="px-4 py-8 text-center text-xs text-muted-foreground"
                        >
                          No models match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredModels.map((model) => {
                        const provider = providerMap.get(model.providerId)
                        const isSelected = selectedModelIds.includes(model.id)

                        return (
                          <TableRow
                            key={model.id}
                            data-state={isSelected ? "selected" : "unselected"}
                            className="cursor-pointer transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                            onClick={() => toggleModelSelected(model.id)}
                          >
                            <TableCell
                              className="px-4 py-3"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() =>
                                  toggleModelSelected(model.id)
                                }
                                aria-label={`Select ${model.modelName}`}
                              />
                            </TableCell>
                            <TableCell className="max-w-0 px-4 py-3">
                              <div className="space-y-0.5">
                                <p className="truncate text-xs font-medium text-foreground">
                                  {model.modelName}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {provider?.name ?? model.providerId}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-0 px-4 py-3">
                              <span className="truncate text-xs text-muted-foreground">
                                {model.modelIdentifier}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className="h-5 rounded-full px-1.5 text-[11px] capitalize"
                              >
                                {model.modelType}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-0 px-4 py-3">
                              <span className="truncate text-xs text-muted-foreground">
                                {provider?.name ?? model.providerId}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={model.enabled}
                                  disabled={pendingToggleId === model.id}
                                  onCheckedChange={(checked) =>
                                    void handleToggle(model, checked)
                                  }
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  {model.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="ml-auto"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      setDialogState({
                                        open: true,
                                        model,
                                        defaultProviderId:
                                          model.providerId as ProviderId,
                                      })
                                    }
                                  >
                                    <PencilIcon className="h-3.5 w-3.5" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => setDeleteTarget(model)}
                                    className="text-destructive"
                                  >
                                    <Trash2Icon className="h-3.5 w-3.5" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-4 space-y-4">
          <RoutingSection
            section="text"
            settings={settings}
            providers={providers}
            models={models}
            onSaved={() => router.refresh()}
          />
          <RoutingSection
            section="embedding"
            settings={settings}
            providers={providers}
            models={models}
            onSaved={() => router.refresh()}
          />
        </TabsContent>
      </Tabs>

      <ModelDialog
        state={dialogState}
        providers={providers}
        onSaved={() => {
          setDialogState({
            open: false,
            model: null,
            defaultProviderId: (providers[0]?.id ?? "openai") as ProviderId,
          })
          router.refresh()
        }}
        onOpenChange={(open) =>
          setDialogState((current) => ({ ...current, open }))
        }
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete model?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the custom model from the provider catalog. The
              change is immediate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function notifyResult(result: AIAdminActionResult) {
  if (result.success) {
    toast.success(result.message)
    return
  }

  toast.error(result.message)
}

function ModelDialog({
  state,
  providers,
  onOpenChange,
  onSaved,
}: {
  state: ModelDialogState
  providers: AIProviderCatalogItem[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<AIModelFormValues>({
    resolver: zodResolver(aiModelFormSchema),
    defaultValues: getModelDefaults(state.model, state.defaultProviderId),
  })

  useEffect(() => {
    form.reset(getModelDefaults(state.model, state.defaultProviderId))
  }, [form, state.defaultProviderId, state.model, state.open])

  async function onSubmit(values: AIModelFormValues) {
    setSubmitting(true)

    const result = values.id
      ? await updateAIModelAction(values)
      : await createAIModelAction(values)

    setSubmitting(false)

    if (!result.success) {
      toast.error(result.message)
      return
    }

    toast.success(result.message)
    onSaved()
  }

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.model ? "Edit model" : "Add model"}</DialogTitle>
          <DialogDescription>
            Configure a provider-backed model and keep the identifier unique per
            provider.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {providers.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8" placeholder="GPT-4o" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="modelIdentifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identifier</FormLabel>
                    <FormControl>
                      <Input {...field} className="h-8" placeholder="gpt-4o" />
                    </FormControl>
                    <FormDescription>
                      Used for routing and must be unique within the provider.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="modelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="embedding">Embedding</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                    <div className="space-y-0.5">
                      <FormLabel>Enabled</FormLabel>
                      <FormDescription>
                        Disabled models stay saved but are excluded from
                        routing.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="h-8 px-3 text-xs"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {state.model ? "Save changes" : "Create model"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function RoutingSection({
  section,
  settings,
  providers,
  models,
  onSaved,
}: {
  section: "text" | "embedding"
  settings: AISettings | null
  providers: AIProviderCatalogItem[]
  models: AIAdminModelRow[]
  onSaved: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<AIConfigSectionValues>({
    resolver: zodResolver(aiConfigSectionSchema),
    defaultValues: getConfigDefaults(settings, section),
  })

  const providerId = form.watch("providerId")
  const provider = getProviderRegistryEntry(providerId)
  const modelOptions = models
    .filter((model) => model.providerId === providerId)
    .filter((model) => model.enabled)
    .filter((model) => model.modelType === section)
    .map((model) => ({
      modelName: model.modelName,
      modelIdentifier: model.modelIdentifier,
      modelType: model.modelType,
    }))

  const defaultOptions = getDefaultModelsForProvider(providerId).filter(
    (option) => option.modelType === section
  )
  const options = [...defaultOptions, ...modelOptions].filter(
    (option, index, array) =>
      array.findIndex(
        (entry) => entry.modelIdentifier === option.modelIdentifier
      ) === index
  )

  useEffect(() => {
    if (!providerId) {
      return
    }

    const currentModelId = form.getValues("modelId")
    const selectedModelExists = options.some(
      (option) => option.modelIdentifier === currentModelId
    )

    if (!selectedModelExists && options[0]) {
      form.setValue("modelId", options[0].modelIdentifier)
    }

    if (provider?.local && !form.getValues("baseUrl")) {
      form.setValue("baseUrl", provider.defaultBaseUrl)
    }

    if (!provider?.local && form.getValues("baseUrl")) {
      form.setValue("baseUrl", "")
    }
  }, [form, options, provider, providerId])

  async function onSubmit(values: AIConfigSectionValues) {
    setSubmitting(true)

    const result =
      section === "text"
        ? await updateTextRoutingAction(values)
        : await updateEmbeddingRoutingAction(values)

    setSubmitting(false)

    if (!result.success) {
      toast.error(result.message)
      return
    }

    toast.success(result.message)
    onSaved()
  }

  return (
    <Card className="rounded-3xl border-border/70 bg-background/90 shadow-sm">
      <CardHeader className="gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-medium tracking-tight">
              {SECTION_LABELS[section]}
            </h2>
            <p className="text-xs text-muted-foreground">
              Route {section === "text" ? "chat and generation" : "vector"}{" "}
              traffic to a specific provider/model pair.
            </p>
          </div>
          <Badge
            variant="outline"
            className="h-6 rounded-full px-2 text-[11px] tracking-wide uppercase"
          >
            {section}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <Form {...form}>
          <form
            className="grid gap-3 lg:grid-cols-2"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 w-full rounded-xl">
                        <SelectValue placeholder="Choose provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getSupportedProvidersForModelType(section).map(
                        (item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 w-full rounded-xl">
                        <SelectValue placeholder="Choose model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem
                          key={option.modelIdentifier}
                          value={option.modelIdentifier}
                        >
                          {option.modelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {options.length === 0
                      ? "Add a model for this provider to route requests here."
                      : `${options.length} available option${options.length === 1 ? "" : "s"}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API key</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      className="h-9 rounded-xl"
                      placeholder="Optional for local providers"
                    />
                  </FormControl>
                  <FormDescription>
                    {provider?.local
                      ? "Optional for Ollama, LM Studio, and other local endpoints."
                      : "Stored in the existing AI settings row."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {provider?.local ? (
              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="h-9 rounded-xl"
                        placeholder={provider.defaultBaseUrl ?? "https://..."}
                      />
                    </FormControl>
                    <FormDescription>
                      Defaults to {provider.defaultBaseUrl}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex justify-end pt-1 lg:col-span-2">
              <Button
                type="submit"
                size="sm"
                className="h-9 px-3 text-xs"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save {section}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
