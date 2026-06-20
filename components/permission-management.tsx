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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  PermissionGuard,
  PermissionButton,
  usePermissions,
} from "@/components/permission-guard"
import {
  Settings,
  Users,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  Key,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  RotateCcw,
} from "lucide-react"

export function PermissionManagementPanel() {
  const { hasPermission } = usePermissions()

  if (!hasPermission("users:read")) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Access Restricted</h3>
          <p className="text-muted-foreground">
            You don&apos;t have permission to manage permissions.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Permission Management</h2>
          <p className="text-muted-foreground">
            Manage user roles, permissions, and access controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Admin Only</Badge>
          <PermissionButton
            permission="users:create"
            onClick={() => console.log("Exporting permissions...")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </PermissionButton>
        </div>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <RoleManagement />
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <PermissionMatrix />
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <UserPermissionManagement />
        </TabsContent>

        {/* Overrides Tab */}
        <TabsContent value="overrides" className="space-y-4">
          <PermissionOverrides />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <PermissionAudit />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RoleManagement() {
  const { hasPermission } = usePermissions()

  const roles = [
    {
      name: "ADMIN",
      description: "Full system access with all permissions",
      userCount: 3,
      permissions: 82,
      color: "bg-red-500",
    },
    {
      name: "PROFESSOR",
      description: "Course management and teaching permissions",
      userCount: 12,
      permissions: 45,
      color: "bg-blue-500",
    },
    {
      name: "STUDENT",
      description: "Learning and participation permissions",
      userCount: 156,
      permissions: 25,
      color: "bg-green-500",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Role Management</h3>
        <PermissionButton
          permission="users:create"
          onClick={() => console.log("Creating new role...")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </PermissionButton>
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-3 w-3 rounded-full ${role.color}`} />
                  <div>
                    <h4 className="font-semibold">{role.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {role.description}
                    </p>
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-sm">{role.userCount} users</span>
                      <span className="text-sm">
                        {role.permissions} permissions
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PermissionButton
                    permission="users:update"
                    variant="outline"
                    size="sm"
                    onClick={() => console.log(`Editing role ${role.name}...`)}
                  >
                    <Edit className="h-4 w-4" />
                  </PermissionButton>
                  <PermissionButton
                    permission="users:read"
                    variant="outline"
                    size="sm"
                    onClick={() => console.log(`Viewing role ${role.name}...`)}
                  >
                    <Eye className="h-4 w-4" />
                  </PermissionButton>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PermissionMatrix() {
  const { hasPermission } = usePermissions()

  const modules = [
    "courses",
    "assignments",
    "quizzes",
    "clubs",
    "learning_hub",
    "files",
    "users",
    "settings",
    "announcements",
    "ai",
  ]

  const actions = ["read", "create", "update", "delete"]

  const roles = ["ADMIN", "PROFESSOR", "STUDENT"]

  // Mock permission data
  const permissionMatrix: Record<
    string,
    Record<string, Record<string, boolean>>
  > = {
    courses: {
      ADMIN: { read: true, create: true, update: true, delete: true },
      PROFESSOR: { read: true, create: true, update: true, delete: false },
      STUDENT: { read: true, create: false, update: false, delete: false },
    },
    assignments: {
      ADMIN: { read: true, create: true, update: true, delete: true },
      PROFESSOR: { read: true, create: true, update: true, delete: true },
      STUDENT: { read: true, create: true, update: true, delete: false },
    },
    // ... other modules
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Permission Matrix</h3>
        <div className="flex items-center gap-2">
          <PermissionButton
            permission="users:update"
            variant="outline"
            onClick={() => console.log("Reset to defaults...")}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </PermissionButton>
          <PermissionButton
            permission="users:update"
            onClick={() => console.log("Saving permission matrix...")}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </PermissionButton>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b p-2 text-left">Module</th>
                  <th
                    className="border-b p-2 text-center"
                    colSpan={actions.length}
                  >
                    ADMIN
                  </th>
                  <th
                    className="border-b p-2 text-center"
                    colSpan={actions.length}
                  >
                    PROFESSOR
                  </th>
                  <th
                    className="border-b p-2 text-center"
                    colSpan={actions.length}
                  >
                    STUDENT
                  </th>
                </tr>
                <tr>
                  <th className="border-b p-2 text-left"></th>
                  {roles.map((role) => (
                    <React.Fragment key={role}>
                      {actions.map((action) => (
                        <th
                          key={`${role}-${action}`}
                          className="border-b p-2 text-center text-xs"
                        >
                          {action}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module}>
                    <td className="border-b p-2 font-medium capitalize">
                      {module.replace("_", " ")}
                    </td>
                    {roles.map((role) => (
                      <React.Fragment key={role}>
                        {actions.map((action) => (
                          <td
                            key={`${role}-${action}`}
                            className="border-b p-2 text-center"
                          >
                            <Switch
                              checked={
                                permissionMatrix[module]?.[role]?.[action] ||
                                false
                              }
                              disabled={!hasPermission("users:update")}
                              onCheckedChange={(checked) =>
                                console.log(
                                  `Toggle ${module}:${action} for ${role}:`,
                                  checked
                                )
                              }
                            />
                          </td>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UserPermissionManagement() {
  const { hasPermission } = usePermissions()

  const users = [
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      role: "PROFESSOR",
      status: "active",
      lastLogin: "2 hours ago",
      customPermissions: 3,
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "STUDENT",
      status: "active",
      lastLogin: "1 day ago",
      customPermissions: 0,
    },
    {
      id: "3",
      name: "Admin User",
      email: "admin@example.com",
      role: "ADMIN",
      status: "active",
      lastLogin: "30 minutes ago",
      customPermissions: 5,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">User Permissions</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="w-64 pl-8"
              onChange={(e) => console.log("Searching:", e.target.value)}
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="professor">Professor</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{user.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="mt-2 flex items-center gap-4">
                      <Badge variant="outline">{user.role}</Badge>
                      <span className="text-sm">
                        Last login: {user.lastLogin}
                      </span>
                      {user.customPermissions > 0 && (
                        <Badge variant="secondary">
                          {user.customPermissions} custom permissions
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <PermissionButton
                    permission="users:update"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      console.log(`Editing permissions for ${user.name}...`)
                    }
                  >
                    <Edit className="h-4 w-4" />
                  </PermissionButton>
                  <PermissionButton
                    permission="users:read"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      console.log(`Viewing permissions for ${user.name}...`)
                    }
                  >
                    <Eye className="h-4 w-4" />
                  </PermissionButton>
                  <Switch
                    checked={user.status === "active"}
                    disabled={!hasPermission("users:update")}
                    onCheckedChange={(checked) =>
                      console.log(`Toggle user ${user.id} status:`, checked)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function PermissionOverrides() {
  const { hasPermission } = usePermissions()

  const overrides = [
    {
      id: "1",
      user: "John Doe",
      permission: "courses:delete",
      granted: true,
      reason: "Department head needs course deletion access",
      grantedBy: "Admin User",
      grantedAt: "2024-01-15",
      expiresAt: "2024-06-15",
    },
    {
      id: "2",
      user: "Jane Smith",
      permission: "clubs:manage_members",
      granted: false,
      reason: "Revoked club leadership permissions",
      grantedBy: "Admin User",
      grantedAt: "2024-01-10",
      expiresAt: null,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Permission Overrides</h3>
        <PermissionButton
          permission="users:update"
          onClick={() => console.log("Creating new override...")}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Override
        </PermissionButton>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {overrides.map((override) => (
              <div
                key={override.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-2 w-2 rounded-full ${override.granted ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <div>
                    <h4 className="font-medium">{override.user}</h4>
                    <p className="text-sm text-muted-foreground">
                      {override.permission}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {override.reason}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>By {override.grantedBy}</span>
                      <span>•</span>
                      <span>{override.grantedAt}</span>
                      {override.expiresAt && (
                        <>
                          <span>•</span>
                          <span>Expires {override.expiresAt}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={override.granted ? "default" : "secondary"}>
                    {override.granted ? "Granted" : "Denied"}
                  </Badge>
                  <PermissionButton
                    permission="users:update"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      console.log(`Editing override ${override.id}...`)
                    }
                  >
                    <Edit className="h-4 w-4" />
                  </PermissionButton>
                  <PermissionButton
                    permission="users:delete"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      console.log(`Removing override ${override.id}...`)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </PermissionButton>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PermissionAudit() {
  const { hasPermission } = usePermissions()

  const auditLogs = [
    {
      id: "1",
      action: "GRANT_PERMISSION",
      user: "Admin User",
      target: "John Doe",
      permission: "courses:delete",
      timestamp: "2024-01-15 14:30:22",
      ip: "192.168.1.100",
      success: true,
    },
    {
      id: "2",
      action: "REVOKE_PERMISSION",
      user: "Admin User",
      target: "Jane Smith",
      permission: "clubs:manage_members",
      timestamp: "2024-01-15 13:45:10",
      ip: "192.168.1.100",
      success: true,
    },
    {
      id: "3",
      action: "UPDATE_ROLE",
      user: "Admin User",
      target: "New User",
      permission: "STUDENT → PROFESSOR",
      timestamp: "2024-01-15 12:20:05",
      ip: "192.168.1.100",
      success: true,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Permission Audit Log</h3>
        <div className="flex items-center gap-2">
          <PermissionButton
            permission="system:view_logs"
            variant="outline"
            onClick={() => console.log("Exporting audit log...")}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </PermissionButton>
          <PermissionButton
            permission="system:manage_settings"
            variant="outline"
            onClick={() => console.log("Clearing audit log...")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Log
          </PermissionButton>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-2 w-2 rounded-full ${log.success ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {log.action.replace("_", " ")}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {log.permission}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {log.user} → {log.target}
                    </p>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{log.timestamp}</span>
                      <span>•</span>
                      <span>IP: {log.ip}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {log.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
