"use client";

import React from "react";
import { useParams } from "next/navigation";
import QuotationPreview from "@/components/quotation/QuotationPreview";

export default function QuotationPreviewPage() {
  const params = useParams();
  const pitchingId = params.id as string;
  const quoteId = params.quoteId as string;

  return <QuotationPreview pitchingId={pitchingId} quoteId={quoteId} />;
}
