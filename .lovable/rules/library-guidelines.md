# tvcc — Guidelines

## Components

The design system exports these components — import them from `@ws-rwrj5um4yjqhbejpny8m/b4f7d096-0b0d-4a25-815e-9faa0862c50f` and compose them before building anything from scratch:

`AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger`, `AlertDialog`, `AppHeader`, `AppSidebar`, `Badge`, `Beacon`, `BulkEditor`, `Button`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`, `Card`, `Checkbox`, `ColorField`, `Constants`, `CountUp`, `DropdownMenuCheckboxItem`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuSub`, `DropdownMenuTrigger`, `DropdownMenu`, `Field`, `Input`, `Label`, `LanguageSwitcher`, `LiveBackdrop`, `LivePulse`, `NotificationBell`, `PopoverAnchor`, `PopoverContent`, `PopoverTrigger`, `Popover`, `ScrollArea`, `ScrollBar`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue`, `Select`, `Separator`, `SheetClose`, `SheetContent`, `SheetDescription`, `SheetFooter`, `SheetHeader`, `SheetOverlay`, `SheetPortal`, `SheetTitle`, `SheetTrigger`, `Sheet`, `SidebarContent`, `SidebarFooter`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarGroupLabel`, `SidebarGroup`, `SidebarHeader`, `SidebarInput`, `SidebarInset`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuButton`, `SidebarMenuItem`, `SidebarMenuSkeleton`, `SidebarMenuSubButton`, `SidebarMenuSubItem`, `SidebarMenuSub`, `SidebarMenu`, `SidebarProvider`, `SidebarRail`, `SidebarSeparator`, `SidebarTrigger`, `Sidebar`, `Skeleton`, `TableBody`, `TableCaption`, `TableCell`, `TableFooter`, `TableHead`, `TableHeader`, `TableRow`, `Table`, `ThemeSwitcher`, `Tilt3D`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`, `Tooltip`

Per-component details (import stanzas, props, variants, examples) live in `.lovable/rules/libraries/{slug}/components.md` — on disk, not auto-loaded. Read that file or the component source when the name alone isn't enough.

## Theme Files

The design system's theme is delivered through the following files. The author's original source files carry the full wiring the design system needs — variable declarations, framework-specific directives, provider objects, etc. — and are the canonical import target.

- `@ws-rwrj5um4yjqhbejpny8m/b4f7d096-0b0d-4a25-815e-9faa0862c50f/lib/themes` (source — preferred import)
- `@ws-rwrj5um4yjqhbejpny8m/b4f7d096-0b0d-4a25-815e-9faa0862c50f/styles.css` (source — preferred import)
- `@ws-rwrj5um4yjqhbejpny8m/b4f7d096-0b0d-4a25-815e-9faa0862c50f/dist/tokens.css` (auto-generated flat list of CSS custom properties — a raw-values fallback only; does NOT carry framework-specific wiring that the source files above provide)

