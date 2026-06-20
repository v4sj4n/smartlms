"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  PermissionGuard,
  PermissionButton,
  PermissionStatus,
} from "@/components/permission-guard"
import { usePermissions } from "@/lib/permissions/hooks"
import {
  Settings,
  Cpu,
  Key,
  BarChart3,
  Zap,
  MessageSquare,
  Shield,
  Users,
  Database,
} from "lucide-react"

export function AISettingsPanel() {
  const { hasPermission, isAdmin, isProfessor } = usePermissions()

  if (!hasPermission("ai:read")) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access AI settings.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Settings</h2>
          <p className="text-muted-foreground">
            Configure AI models, providers, and usage limits
          </p>
        </div>
        <PermissionStatus />
      </div>

      {/* AI Configuration Section */}
      <PermissionGuard permission="ai:configure">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              AI Configuration
            </CardTitle>
            <CardDescription>
              Configure AI providers and models for the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="default-provider">Default Provider</Label>
                <select
                  id="default-provider"
                  className="w-full rounded-md border p-2"
                  disabled={!hasPermission("ai:configure")}
                >
                  <option>OpenAI</option>
                  <option>Anthropic</option>
                  <option>Google</option>
                </select>
              </div>
              <div>
                <Label htmlFor="default-model">Default Model</Label>
                <select
                  id="default-model"
                  className="w-full rounded-md border p-2"
                  disabled={!hasPermission("ai:configure")}
                >
                  <option>gpt-4</option>
                  <option>gpt-3.5-turbo</option>
                  <option>claude-3</option>
                </select>
              </div>
            </div>

            <PermissionButton
              permission="ai:configure"
              className="w-full"
              onClick={() => console.log("Saving AI configuration...")}
            >
              Save Configuration
            </PermissionButton>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Model Management */}
      <PermissionGuard permission="ai:manage_models">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Model Management
            </CardTitle>
            <CardDescription>
              Manage available AI models and their settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { name: "GPT-4", provider: "OpenAI", status: "Active" },
                { name: "Claude-3", provider: "Anthropic", status: "Active" },
                { name: "Gemini Pro", provider: "Google", status: "Inactive" },
              ].map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{model.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {model.provider}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        model.status === "Active" ? "default" : "secondary"
                      }
                    >
                      {model.status}
                    </Badge>
                    <PermissionButton
                      permission="ai:manage_models"
                      variant="outline"
                      size="sm"
                      onClick={() => console.log(`Configure ${model.name}`)}
                    >
                      Configure
                    </PermissionButton>
                  </div>
                </div>
              ))}
            </div>

            <PermissionButton
              permission="ai:manage_models"
              onClick={() => console.log("Adding new model...")}
            >
              Add New Model
            </PermissionButton>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* API Keys Management */}
      <PermissionGuard permission="ai:manage_api_keys">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for AI providers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                {
                  provider: "OpenAI",
                  key: "sk-...****",
                  lastUsed: "2 hours ago",
                },
                {
                  provider: "Anthropic",
                  key: "sk-ant-...****",
                  lastUsed: "1 day ago",
                },
              ].map((apiKey) => (
                <div
                  key={apiKey.provider}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{apiKey.provider}</p>
                    <p className="text-sm text-muted-foreground">
                      Last used: {apiKey.lastUsed}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PermissionButton
                      permission="ai:manage_api_keys"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        console.log(`Rotate ${apiKey.provider} key`)
                      }
                    >
                      Rotate
                    </PermissionButton>
                  </div>
                </div>
              ))}
            </div>

            <PermissionButton
              permission="ai:manage_api_keys"
              onClick={() => console.log("Adding new API key...")}
            >
              Add API Key
            </PermissionButton>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Usage Analytics */}
      <PermissionGuard permission="ai:view_usage">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Analytics
            </CardTitle>
            <CardDescription>
              Monitor AI usage across the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">1,234</p>
                <p className="text-sm text-muted-foreground">Total Requests</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">89.2K</p>
                <p className="text-sm text-muted-foreground">Tokens Used</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">$234</p>
                <p className="text-sm text-muted-foreground">Cost This Month</p>
              </div>
            </div>

            <PermissionButton
              permission="ai:view_usage"
              variant="outline"
              onClick={() => console.log("View detailed analytics...")}
            >
              View Detailed Analytics
            </PermissionButton>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Usage Limits */}
      <PermissionGuard permission="ai:set_limits">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Usage Limits
            </CardTitle>
            <CardDescription>
              Set usage limits for different user roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { role: "STUDENT", dailyLimit: "100", monthlyLimit: "2000" },
              { role: "PROFESSOR", dailyLimit: "500", monthlyLimit: "10000" },
              {
                role: "ADMIN",
                dailyLimit: "Unlimited",
                monthlyLimit: "Unlimited",
              },
            ].map((limit) => (
              <div
                key={limit.role}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{limit.role}</p>
                  <p className="text-sm text-muted-foreground">
                    Daily: {limit.dailyLimit} | Monthly: {limit.monthlyLimit}
                  </p>
                </div>
                <PermissionButton
                  permission="ai:set_limits"
                  variant="outline"
                  size="sm"
                  onClick={() => console.log(`Edit ${limit.role} limits`)}
                >
                  Edit
                </PermissionButton>
              </div>
            ))}
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* AI Tones Management */}
      <PermissionGuard permission="ai:manage_tones">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              AI Tones
            </CardTitle>
            <CardDescription>
              Configure available AI response tones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                "Default",
                "Professional",
                "Friendly",
                "Candid",
                "Quirky",
                "Efficient",
                "Cynical",
              ].map((tone) => (
                <div
                  key={tone}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="font-medium">{tone}</span>
                  <Switch disabled={!hasPermission("ai:manage_tones")} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PermissionGuard>

      {/* Custom Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Custom Instructions
          </CardTitle>
          <CardDescription>
            Set custom AI instructions for personalized responses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PermissionGuard permission="ai:custom_instructions">
            <div>
              <Label htmlFor="custom-instructions">Custom Instructions</Label>
              <Textarea
                id="custom-instructions"
                placeholder="Enter custom instructions for AI responses..."
                className="mt-2"
                rows={4}
                disabled={!hasPermission("ai:custom_instructions")}
              />
            </div>
            <PermissionButton
              permission="ai:custom_instructions"
              onClick={() => console.log("Saving custom instructions...")}
            >
              Save Instructions
            </PermissionButton>
          </PermissionGuard>

          {!hasPermission("ai:custom_instructions") && (
            <div className="rounded-lg border-2 border-dashed p-4 text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Custom instructions require elevated permissions
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
