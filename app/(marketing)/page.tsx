import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { VerticalsShowcase } from "@/components/marketing/VerticalsShowcase";
import { WhatItHandles } from "@/components/marketing/WhatItHandles";
import { Pricing } from "@/components/marketing/Pricing";
import { Faq } from "@/components/marketing/Faq";
import { ClosingCta } from "@/components/marketing/ClosingCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MARKETING_CONFIG } from "@/lib/marketing/content";

export default function MarketingHome() {
  return (
    <>
      <MarketingHeader />
      <Hero />
      <HowItWorks />
      <VerticalsShowcase />
      <WhatItHandles />
      <Pricing period={MARKETING_CONFIG.pricingPeriod} />
      {MARKETING_CONFIG.showFaq && <Faq />}
      <ClosingCta />
      <MarketingFooter />
    </>
  );
}
