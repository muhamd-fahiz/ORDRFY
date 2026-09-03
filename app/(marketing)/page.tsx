import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Hero } from "@/components/marketing/Hero";
import { ProblemRecognition } from "@/components/marketing/ProblemRecognition";
import { TheShift } from "@/components/marketing/TheShift";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { AutomationControl } from "@/components/marketing/AutomationControl";
import { VerticalsShowcase } from "@/components/marketing/VerticalsShowcase";
import { WhatItHandles } from "@/components/marketing/WhatItHandles";
import { Trust } from "@/components/marketing/Trust";
import { Pricing } from "@/components/marketing/Pricing";
import { Faq } from "@/components/marketing/Faq";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MARKETING_CONFIG } from "@/lib/marketing/content";

// The homepage story (docs/architecture/decisions/0039-marketing-homepage-story-redesign.md):
// CHAOS (ProblemRecognition) -> ORGANIZATION (TheShift) -> SIMPLICITY (HowItWorks) ->
// AUTOMATION + CONTROL -> RELEVANCE (VerticalsShowcase) -> VALUE (WhatItHandles) ->
// TRUST -> CONFIDENCE TO ACT (Pricing, Faq, ClosingCta). Order is deliberate, not
// alphabetical or incidental -- read this file top to bottom as the intended visitor journey.
export default function MarketingHome() {
  return (
    <>
      <MarketingHeader />
      <Hero />
      <ProblemRecognition />
      <TheShift />
      <HowItWorks />
      <AutomationControl />
      <VerticalsShowcase />
      <WhatItHandles />
      <Trust />
      <Pricing period={MARKETING_CONFIG.pricingPeriod} />
      {MARKETING_CONFIG.showFaq && <Faq />}
      <ClosingCta />
      <MarketingFooter />
    </>
  );
}
