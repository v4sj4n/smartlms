#!/usr/bin/env tsx

/**
 * Permission System Testing Script
 *
 * This script tests the permission system by checking various scenarios
 * for different user roles and permissions.
 */

import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { PermissionService } from "@/lib/permissions/permissions"
import { hasPermission, canAccessModule } from "@/lib/permissions/rules"
import type { Permission, Module } from "@/lib/permissions/types"

interface TestUser {
  id: string
  email: string
  role: "ADMIN" | "PROFESSOR" | "STUDENT"
}

interface TestResult {
  user: TestUser
  permission: Permission
  expected: boolean
  actual: boolean
  passed: boolean
}

interface ModuleTestResult {
  user: TestUser
  module: Module
  expected: boolean
  actual: boolean
  passed: boolean
}

class PermissionTester {
  private testUsers: TestUser[] = []
  private results: TestResult[] = []
  private moduleResults: ModuleTestResult[] = []

  async setup() {
    console.log("🔍 Setting up permission system tests...")

    // Find test users for each role
    const adminUser = await this.findUserByRole("ADMIN")
    const professorUser = await this.findUserByRole("PROFESSOR")
    const studentUser = await this.findUserByRole("STUDENT")

    if (!adminUser || !professorUser || !studentUser) {
      console.error("❌ Could not find test users for all roles")
      console.log(
        "Please ensure you have users with ADMIN, PROFESSOR, and STUDENT roles"
      )
      process.exit(1)
    }

    this.testUsers = [adminUser, professorUser, studentUser]

    console.log("✅ Test users found:")
    this.testUsers.forEach((user) => {
      console.log(`  - ${user.role}: ${user.email}`)
    })
  }

  private async findUserByRole(
    role: "ADMIN" | "PROFESSOR" | "STUDENT"
  ): Promise<TestUser | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.role, role),
      columns: { id: true, email: true, role: true },
    })

    return user
      ? {
          id: user.id,
          email: user.email,
          role: user.role,
        }
      : null
  }

  async testPermissions() {
    console.log("\n🧪 Testing permission checks...")

    const testCases: Array<{
      permission: Permission
      roles: ("ADMIN" | "PROFESSOR" | "STUDENT")[]
      description: string
    }> = [
      // User Management
      {
        permission: "users:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read users",
      },
      {
        permission: "users:create",
        roles: ["ADMIN"],
        description: "Create users",
      },
      {
        permission: "users:update",
        roles: ["ADMIN", "STUDENT"],
        description: "Update users",
      },
      {
        permission: "users:delete",
        roles: ["ADMIN"],
        description: "Delete users",
      },

      // Course Management
      {
        permission: "courses:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read courses",
      },
      {
        permission: "courses:create",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Create courses",
      },
      {
        permission: "courses:update",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Update courses",
      },
      {
        permission: "courses:delete",
        roles: ["ADMIN"],
        description: "Delete courses",
      },
      {
        permission: "courses:publish",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Publish courses",
      },

      // Assignment Management
      {
        permission: "assignments:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read assignments",
      },
      {
        permission: "assignments:create",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Create assignments",
      },
      {
        permission: "assignments:grade",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Grade assignments",
      },

      // Quiz Management
      {
        permission: "quizzes:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read quizzes",
      },
      {
        permission: "quizzes:create",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Create quizzes",
      },
      {
        permission: "quizzes:grade",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Grade quizzes",
      },

      // File Management
      {
        permission: "files:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read files",
      },
      {
        permission: "files:upload",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Upload files",
      },

      // Club Management
      {
        permission: "clubs:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read clubs",
      },
      {
        permission: "clubs:create",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Create clubs",
      },
      {
        permission: "clubs:manage_members",
        roles: ["ADMIN", "PROFESSOR"],
        description: "Manage club members",
      },

      // Learning Hub Management
      {
        permission: "learning_hub:read",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Read learning hub",
      },
      {
        permission: "learning_hub:create",
        roles: ["ADMIN", "STUDENT"],
        description: "Create learning hub",
      },

      // Academic Management
      {
        permission: "academic:read",
        roles: ["ADMIN"],
        description: "Read academic data",
      },
      {
        permission: "academic:create",
        roles: ["ADMIN"],
        description: "Create academic data",
      },

      // System Management
      {
        permission: "system:read",
        roles: ["ADMIN"],
        description: "Read system data",
      },
      {
        permission: "ai:configure",
        roles: ["ADMIN"],
        description: "Manage AI settings",
      },
    ]

    for (const testCase of testCases) {
      console.log(`\n  Testing: ${testCase.description}`)

      for (const user of this.testUsers) {
        const expected = testCase.roles.includes(user.role)
        const actual = hasPermission(user.role, testCase.permission)
        const passed = expected === actual

        this.results.push({
          user,
          permission: testCase.permission,
          expected,
          actual,
          passed,
        })

        const status = passed ? "✅" : "❌"
        console.log(
          `    ${status} ${user.role}: ${actual ? "GRANTED" : "DENIED"} ${!passed ? "(expected: " + (expected ? "GRANTED" : "DENIED") + ")" : ""}`
        )
      }
    }
  }

  async testModuleAccess() {
    console.log("\n🧪 Testing module access...")

    const moduleTestCases: Array<{
      module: Module
      roles: ("ADMIN" | "PROFESSOR" | "STUDENT")[]
      description: string
    }> = [
      {
        module: "dashboard",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Dashboard access",
      },
      {
        module: "courses",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Courses access",
      },
      {
        module: "assignments",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Assignments access",
      },
      {
        module: "quizzes",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Quizzes access",
      },
      {
        module: "flashcards",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Flashcards access",
      },
      {
        module: "files",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Files access",
      },
      {
        module: "clubs",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Clubs access",
      },
      {
        module: "learning_hub",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Learning hub access",
      },
      { module: "academic", roles: ["ADMIN"], description: "Academic access" },
      { module: "users", roles: ["ADMIN"], description: "Users access" },
      {
        module: "settings",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Settings access",
      },
      {
        module: "announcements",
        roles: ["ADMIN", "PROFESSOR", "STUDENT"],
        description: "Announcements access",
      },
    ]

    for (const testCase of moduleTestCases) {
      console.log(`\n  Testing: ${testCase.description}`)

      for (const user of this.testUsers) {
        const expected = testCase.roles.includes(user.role)
        const actual = canAccessModule(user.role, testCase.module)
        const passed = expected === actual

        this.moduleResults.push({
          user,
          module: testCase.module,
          expected,
          actual,
          passed,
        })

        const status = passed ? "✅" : "❌"
        console.log(
          `    ${status} ${user.role}: ${actual ? "GRANTED" : "DENIED"} ${!passed ? "(expected: " + (expected ? "GRANTED" : "DENIED") + ")" : ""}`
        )
      }
    }
  }

  async testResourcePermissions() {
    console.log("\n🧪 Testing resource-specific permissions...")

    // Test with a sample course ID (you would use a real course ID in production)
    const sampleCourseId = "00000000-0000-0000-0000-000000000000"

    for (const user of this.testUsers) {
      console.log(`\n  Testing resource access for ${user.role}:`)

      try {
        const canReadCourse = await PermissionService.hasPermission(
          user.id,
          "courses:read",
          sampleCourseId,
          "course"
        )
        console.log(
          `    ${canReadCourse ? "✅" : "❌"} Can read course: ${canReadCourse}`
        )

        const canUpdateCourse = await PermissionService.hasPermission(
          user.id,
          "courses:update",
          sampleCourseId,
          "course"
        )
        console.log(
          `    ${canUpdateCourse ? "✅" : "❌"} Can update course: ${canUpdateCourse}`
        )
      } catch (error) {
        console.log(`    ⚠️  Resource permission test failed: ${error}`)
      }
    }
  }

  printSummary() {
    console.log("\n📊 Test Results Summary")
    console.log("=".repeat(50))

    const totalPermissionTests = this.results.length
    const passedPermissionTests = this.results.filter((r) => r.passed).length
    const failedPermissionTests = totalPermissionTests - passedPermissionTests

    const totalModuleTests = this.moduleResults.length
    const passedModuleTests = this.moduleResults.filter((r) => r.passed).length
    const failedModuleTests = totalModuleTests - passedModuleTests

    console.log(`\nPermission Tests:`)
    console.log(`  Total: ${totalPermissionTests}`)
    console.log(`  Passed: ${passedPermissionTests} ✅`)
    console.log(`  Failed: ${failedPermissionTests} ❌`)

    console.log(`\nModule Access Tests:`)
    console.log(`  Total: ${totalModuleTests}`)
    console.log(`  Passed: ${passedModuleTests} ✅`)
    console.log(`  Failed: ${failedModuleTests} ❌`)

    const totalTests = totalPermissionTests + totalModuleTests
    const totalPassed = passedPermissionTests + passedModuleTests
    const totalFailed = totalTests - totalPassed

    console.log(`\nOverall:`)
    console.log(`  Total Tests: ${totalTests}`)
    console.log(`  Passed: ${totalPassed} ✅`)
    console.log(`  Failed: ${totalFailed} ❌`)
    console.log(
      `  Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`
    )

    if (totalFailed > 0) {
      console.log(`\n❌ Some tests failed. Please review the permission rules.`)
      process.exit(1)
    } else {
      console.log(
        `\n✅ All tests passed! The permission system is working correctly.`
      )
    }
  }

  async run() {
    try {
      await this.setup()
      await this.testPermissions()
      await this.testModuleAccess()
      await this.testResourcePermissions()
      this.printSummary()
    } catch (error) {
      console.error("❌ Test execution failed:", error)
      process.exit(1)
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new PermissionTester()
  tester.run()
}

export { PermissionTester }
