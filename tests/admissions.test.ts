import { describe, expect, it } from "vitest";
import { completedAdmissionSchema, provisionalLearnerSchema } from "../src/lib/admissions";

function validAdmission() {
  return {
    learner: { fullName: "Amina Otieno", dateOfBirth: "2018-04-12", gender: "Female", nationality: "Kenyan", upiNumber: "", grade: "Grade 3", stream: "East", admissionDate: "2026-10-25", previousSchool: "", previousClass: "", reasonForLeaving: "", religion: "", languagesSpoken: ["English", "Kiswahili"] },
    residence: { county: "Kisumu", subCounty: "Kisumu Central", ward: "Obunga", village: "Obunga", physicalAddress: "Obunga, Kisumu", landmark: "", distanceToSchoolKm: null, transportMeans: "Walk", latitude: null, longitude: null },
    guardians: [{ fullName: "Grace Otieno", relationship: "Mother", idNumber: "", phone: "+254712345678", alternatePhone: "", whatsapp: true, email: "", occupation: "", employer: "", homeAddress: "", workAddress: "", paysFees: true, primaryContact: true }],
    emergencyContacts: [{ fullName: "Rose Otieno", relationship: "Aunt", phone: "+254722345678" }, { fullName: "Peter Otieno", relationship: "Uncle", phone: "+254732345678" }],
    pickupPersons: [],
    health: { knownConditions: "", allergies: "", currentMedication: "", specialNeeds: "", bloodGroup: "", doctorOrHospital: "", immunizationStatus: "", healthInsurance: "" },
    fee: { term: "2026 Term 3", feePayerGuardian: "Grace Otieno", requestedOptionalItems: ["LUNCH"], handoffNote: "" },
    consent: true
  };
}

describe("admission validation", () => {
  it("allows a consented provisional learner from only basic identity and class details", () => {
    const result = provisionalLearnerSchema.safeParse({
      fullName: "Amina Otieno",
      dateOfBirth: "2018-04-12",
      gender: "Female",
      grade: "Grade 3",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nationality).toBe("Kenyan");
  });

  it("rejects incomplete or unsupported provisional learner details", () => {
    expect(provisionalLearnerSchema.safeParse({ dateOfBirth: "2018-04-12", gender: "Female", grade: "Grade 3" }).success).toBe(false);
    expect(provisionalLearnerSchema.safeParse({ fullName: "Amina Otieno", dateOfBirth: "2018-04-12", gender: "Female", grade: "Grade 10" }).success).toBe(false);
  });

  it("accepts a complete Kenyan school admission", () => {
    expect(completedAdmissionSchema.safeParse(validAdmission()).success).toBe(true);
  });

  it("rejects incomplete consent and missing emergency contacts", () => {
    const input = validAdmission();
    input.consent = false;
    input.emergencyContacts.pop();
    expect(completedAdmissionSchema.safeParse(input).success).toBe(false);
  });

  it("requires one Kenyan primary contact and a valid +254 number", () => {
    const input = validAdmission();
    input.guardians[0].phone = "0712345678";
    input.guardians[0].primaryContact = false;
    expect(completedAdmissionSchema.safeParse(input).success).toBe(false);
  });

  it("keeps class choices within the supported CBC grade range", () => {
    const input = validAdmission();
    input.learner.grade = "Grade 10";
    expect(completedAdmissionSchema.safeParse(input).success).toBe(false);
  });
});
