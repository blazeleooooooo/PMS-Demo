"use client";

import React from "react";
import { useParams } from "next/navigation";
import QuotationEditor from "@/components/quotation/QuotationEditor";

export default function QuotationEditorPage() {
  const params = useParams();
  const pitchingId = params.id as string;
  const quoteId = params.quoteId as string;

  return <QuotationEditor pitchingId={pitchingId} quoteId={quoteId} />;
}
