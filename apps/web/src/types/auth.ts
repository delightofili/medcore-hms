export type UserRole =
  | "SUPER_ADMIN"
  | "HOSPITAL_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "LAB_TECHNICIAN"
  | "PHARMACIST"
  | "ACCOUNTANT"
  | "PATIENT";

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  hospitalId: string | null;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUser;
};

export type RegisterResponse = {
  message: string;
  user: AuthUser;
};
