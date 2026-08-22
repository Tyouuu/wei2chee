import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AtSign,
  BarChart,
  Bell,
  BookOpen,
  Bookmark,
  Bot,
  Box,
  Braces,
  Brain,
  Briefcase,
  Bug,
  Calendar,
  CalendarDays,
  Camera,
  ChartBar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Clock,
  Cloud,
  Code,
  Compass,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Flag,
  Flame,
  Flashlight,
  Gauge,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Globe,
  Grid,
  GripVertical,
  Group,
  HardDrive,
  Heart,
  HeartPulse,
  History,
  Home,
  Image,
  Inbox,
  Info,
  Key,
  Layers,
  LayoutGrid,
  Leaf,
  Lightbulb,
  LineChart,
  Link,
  List,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Minus,
  Palette,
  Play,
  PlayCircle,
  Plus,
  Quote,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Shapes,
  Share,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  Timer,
  Trash,
  TriangleAlert,
  Upload,
  UploadCloud,
  User,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  ZoomIn,
} from "lucide-react";

/**
 * THE ICON THE BLOCK ASKED FOR, ACTUALLY DRAWN.
 *
 * The 164 blocks pulled from the 7Ovr registry (MIT-0) all import an
 * `IconPlaceholder` and hand it the icon they want in five vocabularies at
 * once:
 *
 *     <IconPlaceholder lucide="Compass" tabler="IconCompass"
 *                      hugeicons="CompassIcon" phosphor="Compass"
 *                      remixicon="RiCompass3Line" />
 *
 * because their registry cannot know which icon set a project installed. This
 * one does know: lucide-react, already a dependency, already what every other
 * component in this repo draws with. So the `lucide` name is READ rather than
 * ignored, and a block that asked for a compass gets a compass.
 *
 * The alternative was `import * as icons from "lucide-react"`, which is one
 * line instead of 109 and pulls all 1,300+ icons into the bundle --
 * on a page a Malaysian customer opens over mobile data, on their own website.
 * The named imports below are exactly the 109 icons the pulled blocks
 * actually name, collected by grepping them, so the set stays tree-shakeable.
 * Anything unrecognised falls back to the frame-and-mountain glyph, which is
 * also what a block gets if it names no icon at all.
 *
 * Regenerate after pulling more blocks:
 *   grep -ho lucide=[A-Za-z0-9]* components/blocks/*.tsx | sort -u
 */
const ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AtSign,
  BarChart,
  Bell,
  BookOpen,
  Bookmark,
  Bot,
  Box,
  Braces,
  Brain,
  Briefcase,
  Bug,
  Calendar,
  CalendarDays,
  Camera,
  ChartBar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Clock,
  Cloud,
  Code,
  Compass,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Flag,
  Flame,
  Flashlight,
  Gauge,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Globe,
  Grid,
  GripVertical,
  Group,
  HardDrive,
  Heart,
  HeartPulse,
  History,
  Home,
  Image,
  Inbox,
  Info,
  Key,
  Layers,
  LayoutGrid,
  Leaf,
  Lightbulb,
  LineChart,
  Link,
  List,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Minus,
  Palette,
  Play,
  PlayCircle,
  Plus,
  Quote,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Shapes,
  Share,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Star,
  Timer,
  Trash,
  TriangleAlert,
  Upload,
  UploadCloud,
  User,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  ZoomIn,
};

/** What a 7Ovr block passes. Only `lucide` is read; the other four name the
 *  same icon in icon sets this project does not install, and are accepted so
 *  that the 164 call sites need no editing. */
type PlaceholderProps = React.SVGProps<SVGSVGElement> & {
  lucide?: string;
  tabler?: string;
  hugeicons?: string;
  phosphor?: string;
  remixicon?: string;
  size?: number | string;
};

export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  className,
  size,
  ...props
}: PlaceholderProps) {
  const Named = lucide ? ICONS[lucide] : undefined;
  if (Named) {
    return (
      <Named
        aria-hidden
        className={cn("size-6", className)}
        width={size}
        height={size}
        {...props}
      />
    );
  }
  // No name, or a name from a set we do not carry. Drawn in currentColor and
  // nothing else: a placeholder that picked its own colour would be the one
  // thing on the page ignoring the register the customer chose.
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      className={cn("size-6 opacity-40", className)}
      width={size}
      height={size}
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="15" cy="8" r="1.5" />
    </svg>
  );
}
