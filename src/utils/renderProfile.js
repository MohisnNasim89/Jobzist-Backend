const renderProfile = (entity, type) => {
    if (!entity) {
      throw new Error("Entity not found for rendering profile");
    }
  
    const displayRole = entity.role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  
    if (type === "user") {
      return {
        email: entity.email,
        role: displayRole,
        fullName: entity.profileId?.fullName,
        profilePicture: entity.profileId?.profilePicture,
        bio: entity.profileId?.bio,
        location: entity.profileId?.location,
        phoneNumber: entity.profileId?.phoneNumber,
        socialLinks: entity.profileId?.socialLinks,
        isProfileComplete: entity.profileId?.isProfileComplete,
        roleSpecificData: entity.roleSpecificData,
      };
    } else if (type === "company") {
      return {
        name: entity.profile?.name,
        logo: entity.profile?.logo,
        industry: entity.profile?.industry,
        location: entity.profile?.location,
        website: entity.profile?.website,
        description: entity.profile?.description,
        companySize: entity.profile?.companySize,
        foundedYear: entity.profile?.foundedYear,
        socialLinks: entity.profile?.socialLinks,
      };
    }
  };
  
  module.exports = renderProfile;