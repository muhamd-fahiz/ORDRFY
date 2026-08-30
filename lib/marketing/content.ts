export interface VerticalSlipRow {
  label: string;
  value: string;
  mono: boolean;
  pink: boolean;
}

export interface VerticalContent {
  key: string;
  tab: string;
  tag: string;
  valueProp: string;
  chat: string;
  badge: string;
  rows: VerticalSlipRow[];
  foot: string;
  tracks: string[];
}

// Verbatim from the Claude Design handoff (design_handoff_ordrfy_landing/Ordrfy Landing.dc.html)
// -- final copy, not placeholder. Static data, deliberately not fetched from anywhere: safe
// to move into a CMS later without touching any component that reads this module.
export const MARKETING_VERTICALS: VerticalContent[] = [
  {
    key: "fashion",
    tab: "Fashion & tailoring",
    tag: "Measurements in the chat. Trial dates on the slip.",
    valueProp:
      "Fabric, size, trial and delivery — Ordrfy pulls the details out of the conversation and keeps one slip per customer, with advance and balance already counted.",
    chat: "Blue kurta set, same size as last time. Friday tak?",
    badge: "DUE FRI",
    rows: [
      { label: "ITEM", value: "Kurta set — blue × 2", mono: false, pink: false },
      { label: "MEASUREMENTS", value: "On file · 38 / 40", mono: false, pink: false },
      { label: "TRIAL", value: "Wed 5:00 pm", mono: false, pink: false },
      { label: "ADVANCE", value: "₹500 ✓", mono: true, pink: false },
      { label: "BALANCE", value: "₹1,700", mono: true, pink: true },
    ],
    foot: "TRIAL REMINDER · TUE 6:00 PM",
    tracks: ["Measurement history", "Trial + delivery dates", "Advance vs balance"],
  },
  {
    key: "tutor",
    tab: "Tutors & classes",
    tag: "The fee register that reminds parents for you.",
    valueProp:
      "Batches, timings, monthly fees and attendance in one place. Ordrfy nudges parents before the due date, so you teach instead of chasing.",
    chat: "Rohit ki class Tuesday shift kar sakte hain?",
    badge: "FEE DUE 5 SEP",
    rows: [
      { label: "STUDENT", value: "Rohit · Class 9", mono: false, pink: false },
      { label: "BATCH", value: "Tue + Thu, 6:00 pm", mono: false, pink: false },
      { label: "THIS MONTH", value: "7 of 8 classes", mono: false, pink: false },
      { label: "FEE", value: "₹2,400 / month", mono: true, pink: false },
      { label: "PENDING", value: "₹2,400", mono: true, pink: true },
    ],
    foot: "FEE REMINDER SENT TO PARENT · 3 SEP",
    tracks: ["Batch timings", "Attendance", "Monthly fee reminders"],
  },
  {
    key: "service",
    tab: "Appointment services",
    tag: "Every booking confirmed. Every no-show chased.",
    valueProp:
      "Salon, clinic or studio — slots get confirmed in chat, reminders go out the morning before, and the day sheet is ready before you open the shutter.",
    chat: "Kal 4 baje haircut mil jayega?",
    badge: "SAT 4:00 PM",
    rows: [
      { label: "BOOKING", value: "Haircut + beard", mono: false, pink: false },
      { label: "WITH", value: "Sana · chair 2", mono: false, pink: false },
      { label: "SLOT", value: "Sat 4:00 pm — 40 min", mono: false, pink: false },
      { label: "RATE", value: "₹450", mono: true, pink: false },
      { label: "STATUS", value: "Confirmed", mono: true, pink: true },
    ],
    foot: "REMINDER · SAT 9:00 AM · TAP TO RESCHEDULE",
    tracks: ["Slot calendar", "No-show follow-ups", "Repeat visit history"],
  },
  {
    key: "baker",
    tab: "Home bakers",
    tag: "No birthday missed. No advance forgotten.",
    valueProp:
      "Flavour, weight, the message on the cake, pickup slot and advance — written down the moment the order is agreed, with a reminder the night before you bake.",
    chat: "1kg choco truffle, 'Happy Bday Aarav' likh dena",
    badge: "PICKUP SUN 11 AM",
    rows: [
      { label: "CAKE", value: "Choco truffle · 1 kg", mono: false, pink: false },
      { label: "MESSAGE", value: "“Happy Bday Aarav”", mono: false, pink: false },
      { label: "PICKUP", value: "Sun 11:00 am", mono: false, pink: false },
      { label: "ADVANCE", value: "₹400 ✓", mono: true, pink: false },
      { label: "BALANCE", value: "₹800", mono: true, pink: true },
    ],
    foot: "BAKE REMINDER · SAT 8:00 PM",
    tracks: ["Flavour + weight", "Pickup slots", "Bake-day reminders"],
  },
  {
    key: "gift",
    tab: "Personalized gifts",
    tag: "Surprises that stay surprises — and land on time.",
    valueProp:
      "Personalisation details, reveal dates and delivery windows tracked per order, so the engraving is right and the surprise is not spoiled by a stray message.",
    chat: "Naam engrave karwana hai — 'A & R, 12.09'",
    badge: "REVEAL 12 SEP",
    rows: [
      { label: "GIFT", value: "Engraved photo frame", mono: false, pink: false },
      { label: "ENGRAVING", value: "“A & R · 12.09”", mono: false, pink: false },
      { label: "DELIVER TO", value: "Office · keep sealed", mono: false, pink: false },
      { label: "REVEAL", value: "12 Sep, 7:00 pm", mono: false, pink: false },
      { label: "BALANCE", value: "₹1,150", mono: true, pink: true },
    ],
    foot: "SURPRISE MODE ON · NO UPDATES TO RECIPIENT",
    tracks: ["Personalisation notes", "Reveal date", "Surprise-safe messaging"],
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const MARKETING_FAQS: FaqItem[] = [
  {
    question: "Do my customers need to install anything?",
    answer: "No. They keep chatting on WhatsApp or Instagram exactly as they do today. Ordrfy works on your side.",
  },
  {
    question: "Does it work in Hinglish and regional languages?",
    answer: "Yes. Orders are read from everyday mixed-language chat — Hindi, English, Hinglish and major regional languages.",
  },
  {
    question: "Will it reply to customers without asking me?",
    answer: "Only if you switch that on. By default Ordrfy drafts, and you send. Reminders can be set to go out automatically.",
  },
  {
    question: "Can I use my existing UPI or payment link?",
    answer: "Yes. Ordrfy tracks advances and balances against whatever you already collect with — UPI, cash or a payment link.",
  },
  {
    question: "What if I run two kinds of business?",
    answer: "Slips are per business. Run a boutique and a tuition batch side by side, each with its own order book.",
  },
  {
    question: "Is my customer data safe?",
    answer: "Your chats stay yours. Data is encrypted, stored in India, and never sold or used to advertise to your customers.",
  },
];

/** Mirrors the handoff's editable props (freeOrders / pricingPeriod / showFaq) as one place to adjust. */
export const MARKETING_CONFIG = {
  freeOrders: 50,
  pricingPeriod: "per month" as "per month" | "per year" | "billed yearly",
  showFaq: true,
};
