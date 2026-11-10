import { describe, expect, it } from "vitest";
import { provisionSchoolSchema } from "../src/lib/provisioning";

const valid = {
  name: "Riverside Academy",
  slug: "riverside",
  motto: "Learn and grow",
  slogan: "",
  primaryColour: "#0f766e",
  secondaryColour: "#134E4A",
  accentColour: "#f59e0b",
  contactEmail: "",
  contactPhone: "",
  poBox: "",
  physicalAddress: "",
  directorName: "Riverside Director",
  directorEmail: "Director@Riverside.AC.KE",
  directorPhone: "",
  directorUsername: "",
};

describe("school provisioning validation", () => {
  it("accepts the form and normalises slugs, colours, emails and empty optionals", () => {
    const parsed = provisionSchoolSchema.parse(valid);
    expect(parsed.slug).toBe("riverside");
    expect(parsed.secondaryColour).toBe("#134e4a");
    expect(parsed.directorEmail).toBe("director@riverside.ac.ke");
    expect(parsed.contactEmail).toBeUndefined();
    expect(parsed.contactPhone).toBeUndefined();
    expect(parsed.directorPhone).toBeUndefined();
    expect(parsed.directorUsername).toBeUndefined();
  });

  it("normalises a username and accepts Indian-style phone formatting", () => {
    const parsed = provisionSchoolSchema.parse({
      ...valid,
      contactPhone: "+254 (712) 345-678",
      directorUsername: "Riverside.Director",
    });
    expect(parsed.contactPhone).toBe("+254 (712) 345-678");
    expect(parsed.directorUsername).toBe("riverside.director");
  });

  it("rejects reserved platform and demo subdomains", () => {
    for (const slug of ["maryroyal", "demo", "superadmin", "admin", "www", "api"]) {
      const result = provisionSchoolSchema.safeParse({ ...valid, slug });
      expect(result.success, slug).toBe(false);
    }
  });

  it("rejects malformed slugs, colours, emails and phone numbers", () => {
    expect(provisionSchoolSchema.safeParse({ ...valid, slug: "-riverside-" }).success).toBe(false);
    expect(provisionSchoolSchema.safeParse({ ...valid, primaryColour: "teal" }).success).toBe(false);
    expect(provisionSchoolSchema.safeParse({ ...valid, directorEmail: "not-an-email" }).success).toBe(false);
    expect(provisionSchoolSchema.safeParse({ ...valid, contactPhone: "call me" }).success).toBe(false);
  });

  it("rejects unknown fields so request payloads stay strict", () => {
    const result = provisionSchoolSchema.safeParse({ ...valid, schoolId: "school_demo_mary_royal" });
    expect(result.success).toBe(false);
  });
});
