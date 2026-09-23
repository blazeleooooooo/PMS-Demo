"use client";

import React, { useState } from "react";
import TopNav from "@/components/dashboard/TopNav";

export default function ReceivableLoading() {
  return (
    <div className="min-h-screen bg-bw-bg">
      <div className="pt-[52px] lg:ml-[200px]">
        <main className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        </main>
      </div>
    </div>
  );
}
