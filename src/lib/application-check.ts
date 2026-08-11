export async function checkExistingApplications() {
  try {
    const response = await fetch("/api/applications/check-existing");
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("Error checking existing applications:", error);
    return null;
  }
}
