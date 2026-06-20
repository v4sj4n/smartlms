"use client"

import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PermissionGuard,
  PermissionButton,
  usePermissions,
} from "@/components/permission-guard"
import {
  Cpu,
  Key,
  Zap,
  Shield,
  Users,
  Database,
  Globe,
  Bell,
  Lock,
  FileText,
  Archive,
  RefreshCw,
} from "lucide-react"

export function AdminSettingsPanel() {
  const { hasPermission } = usePermissions()

  if (!hasPermission("settings:update")) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don&apos;t have permission to access system settings.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Settings</h2>
          <p className="text-muted-foreground">
            Configure platform settings, AI features, and system preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Admin Only</Badge>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Platform Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Platform Information
                </CardTitle>
                <CardDescription>
                  Basic platform configuration and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="platform-name">Platform Name</Label>
                  <Input
                    id="platform-name"
                    defaultValue="SmartLMS"
                    disabled={!hasPermission("settings:update")}
                  />
                </div>
                <div>
                  <Label htmlFor="platform-description">
                    Platform Description
                  </Label>
                  <Textarea
                    id="platform-description"
                    defaultValue="Next-generation learning management system"
                    disabled={!hasPermission("settings:update")}
                  />
                </div>
                <div>
                  <Label htmlFor="admin-email">Admin Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    defaultValue="admin@smartlms.edu"
                    disabled={!hasPermission("settings:update")}
                  />
                </div>
                <PermissionButton
                  permission="settings:update"
                  onClick={() => console.log("Saving platform settings...")}
                >
                  Save Platform Settings
                </PermissionButton>
              </CardContent>
            </Card>

            {/* Academic Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Academic Settings
                </CardTitle>
                <CardDescription>
                  Configure academic year and grading policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="default-semester">Default Semester</Label>
                  <select
                    id="default-semester"
                    className="w-full rounded-md border p-2"
                    disabled={!hasPermission("academic:manage_semesters")}
                  >
                    <option>Fall</option>
                    <option>Spring</option>
                    <option>Summer</option>
                    <option>Winter</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="passing-grade">Passing Grade (%)</Label>
                  <Input
                    id="passing-grade"
                    type="number"
                    defaultValue="60"
                    disabled={!hasPermission("academic:manage_semesters")}
                  />
                </div>
                <div>
                  <Label htmlFor="max-enrollment">
                    Max Enrollment per Course
                  </Label>
                  <Input
                    id="max-enrollment"
                    type="number"
                    defaultValue="100"
                    disabled={!hasPermission("academic:manage_semesters")}
                  />
                </div>
                <PermissionButton
                  permission="academic:manage_semesters"
                  onClick={() => console.log("Saving academic settings...")}
                >
                  Save Academic Settings
                </PermissionButton>
              </CardContent>
            </Card>
          </div>

          {/* System Maintenance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                System Maintenance
              </CardTitle>
              <CardDescription>
                Data cleanup, backups, and system maintenance tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <h4 className="font-medium">Data Cleanup</h4>
                  <p className="text-sm text-muted-foreground">
                    Remove old data and optimize storage
                  </p>
                  <PermissionButton
                    permission="system:manage_backups"
                    variant="outline"
                    onClick={() => console.log("Running data cleanup...")}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Run Cleanup
                  </PermissionButton>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Backup Database</h4>
                  <p className="text-sm text-muted-foreground">
                    Create a full system backup
                  </p>
                  <PermissionButton
                    permission="system:manage_backups"
                    variant="outline"
                    onClick={() => console.log("Creating backup...")}
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Create Backup
                  </PermissionButton>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">System Logs</h4>
                  <p className="text-sm text-muted-foreground">
                    View system activity logs
                  </p>
                  <PermissionButton
                    permission="system:view_logs"
                    variant="outline"
                    onClick={() => console.log("Viewing system logs...")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Logs
                  </PermissionButton>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-4">
          {/* AI Configuration */}
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
                  onClick={() => console.log("Saving AI configuration...")}
                >
                  Save Configuration
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
                  {
                    role: "PROFESSOR",
                    dailyLimit: "500",
                    monthlyLimit: "10000",
                  },
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
                        Daily: {limit.dailyLimit} | Monthly:{" "}
                        {limit.monthlyLimit}
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

          {/* API Keys */}
          <PermissionGuard permission="ai:manage_api_keys">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys
                </CardTitle>
                <CardDescription>
                  Manage API keys for AI providers
                </CardDescription>
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
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Authentication Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Authentication
                </CardTitle>
                <CardDescription>
                  Configure authentication and security policies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="2fa">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require 2FA for admin accounts
                    </p>
                  </div>
                  <Switch
                    id="2fa"
                    disabled={!hasPermission("settings:manage_security")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="session-timeout">Session Timeout</Label>
                    <p className="text-sm text-muted-foreground">
                      Auto-logout after inactivity
                    </p>
                  </div>
                  <select
                    id="session-timeout"
                    className="rounded-md border p-2"
                    disabled={!hasPermission("settings:manage_security")}
                  >
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>4 hours</option>
                    <option>1 day</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="password-policy">
                      Strong Password Policy
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Require complex passwords
                    </p>
                  </div>
                  <Switch
                    id="password-policy"
                    defaultChecked
                    disabled={!hasPermission("settings:manage_security")}
                  />
                </div>
                <PermissionButton
                  permission="settings:manage_security"
                  onClick={() => console.log("Saving security settings...")}
                >
                  Save Security Settings
                </PermissionButton>
              </CardContent>
            </Card>

            {/* User Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Configure user account policies and restrictions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="user-approval">Manual User Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Require admin approval for new accounts
                    </p>
                  </div>
                  <Switch
                    id="user-approval"
                    disabled={!hasPermission("users:create")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-verification">
                      Email Verification
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Require email verification
                    </p>
                  </div>
                  <Switch
                    id="email-verification"
                    defaultChecked
                    disabled={!hasPermission("users:create")}
                  />
                </div>
                <div>
                  <Label htmlFor="max-users">Maximum Users</Label>
                  <Input
                    id="max-users"
                    type="number"
                    placeholder="Unlimited"
                    disabled={!hasPermission("users:create")}
                  />
                </div>
                <PermissionButton
                  permission="users:create"
                  onClick={() =>
                    console.log("Saving user management settings...")
                  }
                >
                  Save User Settings
                </PermissionButton>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Configuration
              </CardTitle>
              <CardDescription>
                Configure email and in-app notification settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 font-medium">Email Notifications</h4>
                  <div className="space-y-3">
                    {[
                      "Assignment deadlines",
                      "New announcements",
                      "Grade updates",
                      "Course enrollments",
                      "System maintenance",
                    ].map((notification) => (
                      <div
                        key={notification}
                        className="flex items-center justify-between"
                      >
                        <Label>{notification}</Label>
                        <Switch
                          defaultChecked={[
                            "Assignment deadlines",
                            "New announcements",
                            "Grade updates",
                          ].includes(notification)}
                          disabled={
                            !hasPermission("settings:manage_notifications")
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 font-medium">In-App Notifications</h4>
                  <div className="space-y-3">
                    {[
                      "New messages",
                      "Assignment feedback",
                      "Quiz results",
                      "Club updates",
                      "AI responses",
                    ].map((notification) => (
                      <div
                        key={notification}
                        className="flex items-center justify-between"
                      >
                        <Label>{notification}</Label>
                        <Switch
                          defaultChecked={[
                            "New messages",
                            "Assignment feedback",
                            "Quiz results",
                          ].includes(notification)}
                          disabled={
                            !hasPermission("settings:manage_notifications")
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-from">From Email Address</Label>
                    <p className="text-sm text-muted-foreground">
                      Email address for system notifications
                    </p>
                  </div>
                  <Input
                    id="email-from"
                    type="email"
                    defaultValue="noreply@smartlms.edu"
                    className="w-64"
                    disabled={!hasPermission("settings:manage_notifications")}
                  />
                </div>
              </div>

              <PermissionButton
                permission="settings:manage_notifications"
                onClick={() => console.log("Saving notification settings...")}
              >
                Save Notification Settings
              </PermissionButton>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
