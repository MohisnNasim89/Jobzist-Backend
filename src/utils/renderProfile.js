const renderProfile = (entity, type) => {
  if (type === "company") {
    return {
      name: entity.name || "Unnamed Company",
      industry: entity.industry || "Unknown Industry",
      location: entity.location || { country: "Unknown", city: "Unknown", address: "Unknown" },
      website: entity.website || "Not provided",
      websiteDomain: entity.website ? new URL(entity.website).hostname : "Not provided",
      description: entity.description || "No description available",
      descriptionSummary: entity.description
        ? entity.description.split(" ").slice(0, 10).join(" ") || "No description"
        : "No description",
      companySize: entity.companySize || "Unknown",
      foundedYear: entity.foundedYear || "Unknown",
      socialLinks: entity.socialLinks || [],
      logo: entity.logo || "Not provided",
      jobListings: entity.jobListings || [],
    };
  }

  if (type === "job") {
    return {
      _id: entity._id,
      title: entity.title || "Untitled Job",
      companyId: entity.companyId || null,
      company: entity.companyId ? { _id: entity.companyId._id, name: entity.companyId.name, logo: entity.companyId.logo } : null,
      postedBy: entity.postedBy?.profileId?.fullName || "Unknown",
      description: entity.description || "No description",
      location: entity.location || { country: "Unknown", city: "Unknown" },
      jobType: entity.jobType || "Unknown",
      salary: entity.salary || { min: 0, max: 0, currency: "Unknown" },
      requirements: entity.requirements || [],
      skills: entity.skills || [],
      experienceLevel: entity.experienceLevel || "Unknown",
      applicationDeadline: entity.applicationDeadline || null,
      status: entity.status || "Unknown",
      createdAt: entity.createdAt || null,
    };
  }

  if (type === "job_seeker") {
    return {
      userId: entity.userId || null,
      resume: entity.resume || "Not provided",
      skills: entity.skills || [],
      education: entity.education || [],
      experience: entity.experience || [],
      jobPreferences: entity.jobPreferences || {},
      appliedJobs: entity.appliedJobs || [],
      savedJobs: entity.savedJobs || [],
      status: entity.status || "Unknown",
    };
  }

  if (type === "employer") {
    return {
      userId: entity.userId || null,
      roleType: entity.roleType || "Unknown",
      companyId: entity.companyId || null,
      companyName: entity.companyName || "Not associated",
      jobListings: entity.jobListings || [],
      hiredCandidates: entity.hiredCandidates || [],
      status: entity.status || "Unknown",
    };
  }

  if (type === "user") {
    return {
      authId: entity.authId || "Unknown",
      email: entity.email || "Unknown",
      role: entity.role || "Unknown",
      profile: entity.profileId || {},
      roleSpecificData: entity.roleSpecificData || {},
    };
  }

  throw new Error("Invalid profile type");
};

module.exports = renderProfile;