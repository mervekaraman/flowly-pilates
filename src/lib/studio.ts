// Single-studio setup. Contact details come from the environment so they can be filled in
// without code changes; anything left empty is simply not shown in the UI.
// Server-only fields (env) must not be read in client components — pass them down as props.
export const studio = {
  name: "Flowly Pilates",
  shortDescription: "Reformer pilatesi küçük gruplarda, eğitmen eşliğinde ve kendi ritminde.",
  description: "Flowly Pilates'te dersler reformer üzerinde, küçük gruplarla ve eğitmen eşliğinde yapılır; hareketler seviyene ve bedeninin ihtiyacına göre uyarlanır.",
  heroImage: "/images/flowly/studio-main.webp",
  secondaryImage: "/images/flowly/studio-alt.webp",
  openDaysLabel: "Pazartesi – Cumartesi",
  cancellationHours: 12,
  // Data controller (veri sorumlusu) for the KVKK notice: the studio's registered legal name,
  // and the address KVKK requests go to (falls back to the studio e-mail).
  legalName: process.env.LEGAL_ENTITY_NAME ?? "",
  kvkkEmail: process.env.KVKK_CONTACT_EMAIL ?? "",
  address: process.env.STUDIO_ADDRESS ?? "",
  phone: process.env.STUDIO_PHONE ?? "",
  email: process.env.STUDIO_EMAIL ?? "",
  instagram: process.env.STUDIO_INSTAGRAM ?? "",
};

// Classes start on the hour (07:00–21:00); the new-lesson form and its validation share this list.
export const lessonStartTimes = Array.from({ length: 21 - 7 + 1 }, (_, index) => `${String(7 + index).padStart(2, "0")}:00`);

// No per-class price: members pay for their membership up front, outside the app.
export const lessonDefaults = { durationMin: 50, capacity: 4 };
