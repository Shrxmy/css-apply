const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function getAcceptedCounts() {
  try {
    console.log("🔍 Fetching accepted counts...\n");

    // Get accepted members count
    const acceptedMembers = await prisma.memberApplication.count({
      where: {
        hasAccepted: true,
      },
    });

    // Get accepted EAs count
    const acceptedEAs = await prisma.eAApplication.count({
      where: {
        hasAccepted: true,
      },
    });

    // Get accepted committee staff count
    const acceptedStaff = await prisma.committeeApplication.count({
      where: {
        hasAccepted: true,
      },
    });

    // Calculate total
    const total = acceptedMembers + acceptedEAs + acceptedStaff;

    console.log("📊 ACCEPTED COUNTS:");
    console.log("==================");
    console.log(`👥 Accepted Members: ${acceptedMembers}`);
    console.log(`🎯 Accepted EAs: ${acceptedEAs}`);
    console.log(`👨‍💼 Accepted Staff: ${acceptedStaff}`);
    console.log("==================");
    console.log(`📈 TOTAL ACCEPTED: ${total}`);
    console.log("==================\n");

    // Also show some additional details
    console.log("📋 DETAILED BREAKDOWN:");
    console.log("======================");

    // Get some sample data for verification
    const sampleMembers = await prisma.memberApplication.findMany({
      where: { hasAccepted: true },
      select: {
        studentNumber: true,
        user: { select: { name: true, email: true } },
      },
      take: 3,
    });

    const sampleEAs = await prisma.eAApplication.findMany({
      where: { hasAccepted: true },
      select: {
        studentNumber: true,
        ebRole: true,
        user: { select: { name: true, email: true } },
      },
      take: 3,
    });

    const sampleStaff = await prisma.committeeApplication.findMany({
      where: { hasAccepted: true },
      select: {
        studentNumber: true,
        firstOptionCommittee: true,
        user: { select: { name: true, email: true } },
      },
      take: 3,
    });

    if (sampleMembers.length > 0) {
      console.log("\n👥 Sample Accepted Members:");
      sampleMembers.forEach((member) => {
        console.log(
          `   - ${member.user.name} (${member.studentNumber}) - ${member.user.email}`,
        );
      });
    }

    if (sampleEAs.length > 0) {
      console.log("\n🎯 Sample Accepted EAs:");
      sampleEAs.forEach((ea) => {
        console.log(
          `   - ${ea.user.name} (${ea.studentNumber}) - ${ea.ebRole} - ${ea.user.email}`,
        );
      });
    }

    if (sampleStaff.length > 0) {
      console.log("\n👨‍💼 Sample Accepted Staff:");
      sampleStaff.forEach((staff) => {
        console.log(
          `   - ${staff.user.name} (${staff.studentNumber}) - ${staff.firstOptionCommittee} - ${staff.user.email}`,
        );
      });
    }
  } catch (error) {
    console.error("❌ Error fetching accepted counts:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
getAcceptedCounts();
