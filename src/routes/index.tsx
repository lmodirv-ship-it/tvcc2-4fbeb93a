import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe, Shield, Bell, Zap, Database, HardDrive,
  Activity, Layers, ArrowLeft, CheckCircle2, Sparkles, Users, BookOpen, Cloud,
}