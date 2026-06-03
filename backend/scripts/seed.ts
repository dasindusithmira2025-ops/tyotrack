import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const REPORT_DEMO_EMPLOYEE = {
  id: "employee-lexmac-sithmira",
  name: "Lexmac Sithmira",
  email: "lexmacsithmira@gmail.com",
  password: "Dasindu@13#"
};

const REPORT_DEMO_PROJECTS = [
  { id: "project-synlab", name: "Synlab", color: "#0ea5e9" },
  { id: "project-espresso-house", name: "Espresso House", color: "#a16207" },
  { id: "project-extra-works", name: "Extra Works", color: "#22c55e" }
];

const REPORT_DEMO_ENTRIES = [
  {
    id: "report-demo-synlab-2026-05-28",
    splitId: "report-demo-split-synlab-2026-05-28",
    projectId: "project-synlab",
    startTime: new Date("2026-05-28T15:00:00.000Z"),
    endTime: new Date("2026-05-28T16:45:00.000Z"),
    totalHours: 1.75,
    eveningHours: 1.75,
    nightHours: 0,
    notes: "Report demo: Synlab evening entry"
  },
  {
    id: "report-demo-espresso-house-2026-05-28",
    splitId: "report-demo-split-espresso-house-2026-05-28",
    projectId: "project-espresso-house",
    startTime: new Date("2026-05-28T17:00:00.000Z"),
    endTime: new Date("2026-05-28T18:30:00.000Z"),
    totalHours: 1.5,
    eveningHours: 1.5,
    nightHours: 0,
    notes: "Report demo: Espresso House evening entry"
  },
  {
    id: "report-demo-extra-works-2026-05-28",
    splitId: "report-demo-split-extra-works-2026-05-28",
    projectId: "project-extra-works",
    startTime: new Date("2026-05-28T10:00:00.000Z"),
    endTime: new Date("2026-05-28T13:00:00.000Z"),
    totalHours: 3,
    eveningHours: 0,
    nightHours: 0,
    notes: "Report demo: Extra Works daytime entry"
  }
];

async function main() {
  const superEmail = "super@tyo.com";
  const adminEmail = "alice@acme.com";
  const employeeEmail = "bob@acme.com";

  const acmeTenantId = "acme-corp";

  await prisma.company.upsert({
    where: { tenantId: acmeTenantId },
    update: {},
    create: {
      tenantId: acmeTenantId,
      name: "Acme Corp",
      email: "contact@acme.com",
      timezone: "Europe/Helsinki"
    }
  });

  await prisma.workspace.upsert({
    where: { id: acmeTenantId },
    update: {
      tenantId: acmeTenantId,
      name: "General",
      status: "ACTIVE"
    },
    create: {
      id: acmeTenantId,
      tenantId: acmeTenantId,
      name: "General",
      status: "ACTIVE"
    }
  });

  const policy = await prisma.policy.findFirst({ where: { tenantId: acmeTenantId, isActive: true } });
  if (!policy) {
    await prisma.policy.create({
      data: {
        tenantId: acmeTenantId,
        eveningStart: "18:00",
        eveningEnd: "22:00",
        nightStart: "22:00",
        nightEnd: "06:00",
        isActive: true
      }
    });
  }

  const superHash = await hashPassword("password123");
  const adminHash = await hashPassword("password123");
  const employeeHash = await hashPassword("password123");
  const reportDemoEmployeeHash = await hashPassword(REPORT_DEMO_EMPLOYEE.password);

  await prisma.user.upsert({
    where: { email: superEmail },
    update: {
      passwordHash: superHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      tenantId: null
    },
    create: {
      name: "Super Admin",
      email: superEmail,
      passwordHash: superHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE"
    }
  });

  const reportDemoEmployee = await prisma.user.upsert({
    where: { email: REPORT_DEMO_EMPLOYEE.email },
    update: {
      name: REPORT_DEMO_EMPLOYEE.name,
      passwordHash: reportDemoEmployeeHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      tenantId: acmeTenantId,
      autoApproveEntries: true,
      backdateLimitDays: 30
    },
    create: {
      id: REPORT_DEMO_EMPLOYEE.id,
      tenantId: acmeTenantId,
      name: REPORT_DEMO_EMPLOYEE.name,
      email: REPORT_DEMO_EMPLOYEE.email,
      passwordHash: reportDemoEmployeeHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      autoApproveEntries: true,
      backdateLimitDays: 30
    }
  });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminHash,
      role: "COMPANY_ADMIN",
      status: "ACTIVE",
      tenantId: acmeTenantId
    },
    create: {
      tenantId: acmeTenantId,
      name: "Alice Manager",
      email: adminEmail,
      passwordHash: adminHash,
      role: "COMPANY_ADMIN",
      status: "ACTIVE"
    }
  });

  await prisma.user.upsert({
    where: { email: employeeEmail },
    update: {
      passwordHash: employeeHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      tenantId: acmeTenantId
    },
    create: {
      tenantId: acmeTenantId,
      name: "Bob Worker",
      email: employeeEmail,
      passwordHash: employeeHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      backdateLimitDays: 7
    }
  });

  const project = await prisma.project.findFirst({ where: { tenantId: acmeTenantId, name: "Core Platform" } });
  if (!project) {
    await prisma.project.create({
      data: {
        tenantId: acmeTenantId,
        name: "Core Platform",
        color: "#3b82f6",
        status: "ACTIVE",
        workspaceId: acmeTenantId
      }
    });
  }

  for (const reportProject of REPORT_DEMO_PROJECTS) {
    await prisma.project.upsert({
      where: { id: reportProject.id },
      update: {
        tenantId: acmeTenantId,
        name: reportProject.name,
        color: reportProject.color,
        status: "ACTIVE",
        workspaceId: acmeTenantId
      },
      create: {
        id: reportProject.id,
        tenantId: acmeTenantId,
        name: reportProject.name,
        color: reportProject.color,
        status: "ACTIVE",
        workspaceId: acmeTenantId
      }
    });

    await prisma.projectAssignment.upsert({
      where: {
        projectId_userId: {
          projectId: reportProject.id,
          userId: reportDemoEmployee.id
        }
      },
      update: {
        tenantId: acmeTenantId
      },
      create: {
        tenantId: acmeTenantId,
        projectId: reportProject.id,
        userId: reportDemoEmployee.id
      }
    });
  }

  const reportDemoDate = "2026-05-28";
  const reportDemoDateUtc = new Date("2026-05-27T21:00:00.000Z");

  for (const reportEntry of REPORT_DEMO_ENTRIES) {
    await prisma.timeEntry.upsert({
      where: { id: reportEntry.id },
      update: {
        tenantId: acmeTenantId,
        userId: reportDemoEmployee.id,
        createdById: null,
        projectId: reportEntry.projectId,
        workspaceId: acmeTenantId,
        startTime: reportEntry.startTime,
        endTime: reportEntry.endTime,
        notes: reportEntry.notes,
        status: "APPROVED",
        totalHours: reportEntry.totalHours,
        eveningHours: reportEntry.eveningHours,
        nightHours: reportEntry.nightHours,
        lockedAt: new Date("2026-05-28T19:00:00.000Z")
      },
      create: {
        id: reportEntry.id,
        tenantId: acmeTenantId,
        userId: reportDemoEmployee.id,
        projectId: reportEntry.projectId,
        workspaceId: acmeTenantId,
        startTime: reportEntry.startTime,
        endTime: reportEntry.endTime,
        notes: reportEntry.notes,
        status: "APPROVED",
        totalHours: reportEntry.totalHours,
        eveningHours: reportEntry.eveningHours,
        nightHours: reportEntry.nightHours,
        lockedAt: new Date("2026-05-28T19:00:00.000Z")
      }
    });

    await prisma.timeEntrySplit.upsert({
      where: { id: reportEntry.splitId },
      update: {
        tenantId: acmeTenantId,
        timeEntryId: reportEntry.id,
        userId: reportDemoEmployee.id,
        projectId: reportEntry.projectId,
        date: reportDemoDateUtc,
        localDate: reportDemoDate,
        startTime: reportEntry.startTime,
        endTime: reportEntry.endTime,
        status: "APPROVED",
        totalHours: reportEntry.totalHours,
        eveningHours: reportEntry.eveningHours,
        nightHours: reportEntry.nightHours,
        notes: reportEntry.notes,
        approvedById: null,
        approvedAt: new Date("2026-05-28T19:00:00.000Z"),
        rejectionReason: null
      },
      create: {
        id: reportEntry.splitId,
        tenantId: acmeTenantId,
        timeEntryId: reportEntry.id,
        userId: reportDemoEmployee.id,
        projectId: reportEntry.projectId,
        date: reportDemoDateUtc,
        localDate: reportDemoDate,
        startTime: reportEntry.startTime,
        endTime: reportEntry.endTime,
        status: "APPROVED",
        totalHours: reportEntry.totalHours,
        eveningHours: reportEntry.eveningHours,
        nightHours: reportEntry.nightHours,
        notes: reportEntry.notes,
        approvedAt: new Date("2026-05-28T19:00:00.000Z")
      }
    });
  }

  console.log(
    "Seed complete. Demo credentials:\n- super@tyo.com / password123\n- alice@acme.com / password123\n- bob@acme.com / password123\n- lexmacsithmira@gmail.com / Dasindu@13#"
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
