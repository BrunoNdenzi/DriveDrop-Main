# DriveDrop Design Constitution
## Enterprise Operations Vehicle Logistics System

---

## 1. Product Identity

DriveDrop is an **enterprise-grade vehicle logistics and fleet operations platform**.

It is **not**:
- A startup landing page
- A consumer SaaS product
- A marketing-first website

It **is**:
- A system for executing vehicle transport
- An operational control surface
- A logistics infrastructure product

Design decisions must prioritize **operational clarity, system state visibility, and execution efficiency** over visual novelty.

---

## 2. Primary Design Principles

1. **Operations First**
   - UI exists to control real-world processes.
   - Every screen must answer: *What is happening? What happens next?*

2. **Role-Based by Default**
   - Client, Driver, and Admin interfaces are distinct.
   - No shared dashboards or layouts across roles.

3. **State Over Story**
   - Show system state instead of explaining concepts.
   - Replace descriptions with timelines, tables, and status indicators.

4. **Constraint-Driven UI**
   - Capacity, routing, timing, and verification are first-class concepts.
   - Visuals must reflect real-world constraints.

---

## 3. Forbidden UI Patterns (Never Use)

The following patterns are **explicitly banned** across the entire platform:

- “How It Works” sections
- Step-based flows (1 → 2 → 3 cards)
- Icon-only feature grids
- Center-aligned marketing sections
- Rounded floating stat cards
- Decorative gradients as primary UI elements
- Friendly onboarding banners (“Welcome back”, emojis)
- Generic SaaS dashboards
- Hero slogans without operational context
- Abstract illustrations or SVG hero art

If a generated component resembles a startup template, it must be rewritten.

---

## 4. Required UI Patterns

The following patterns must be preferred:

- **Timelines** instead of step cards
- **Tables** instead of feature tiles
- **Maps and routes** instead of illustrations
- **Status-driven UI** (Assigned, In Transit, Delivered, Exception)
- **Left-aligned layouts** with structured grids
- **Dense but readable interfaces**
- **Action-first layouts** (what the user must do next is dominant)

---

## 5. Visual System

### Color
- Backgrounds: white, off-white, light gray
- Primary accent: teal (actions and interactive elements only)
- Status colors:
  - Green: Delivered / Completed
  - Amber: In Transit / Pending
  - Red: Exception / Issue
  - Gray: Inactive / Archived

### Typography
- Functional, highly legible fonts
- No decorative or novelty fonts
- Clear hierarchy using size and weight, not color

### Layout
- Borders preferred over shadows
- Minimal border radius (2–4px maximum)
- No floating cards unless functionally required
- Spacing favors clarity over airiness

---

## 6. Visual Assets & Media Rules

### General Rule
AI agents must **not invent or design visual assets**.

Agents may only render visuals from **approved sources** and under **strict usage rules**.

---

### Images

Images must represent **real-world logistics operations**:

Allowed:
- Trucks
- Vehicles
- Drivers at work
- Routes
- Terminals
- Loading / unloading scenes

Forbidden:
- Abstract illustrations
- Cartoon imagery
- SVG hero art
- Conceptual graphics

#### Image Sources
- `/public/images/` (local assets)
- Realistic stock-photo placeholders (clearly labeled)
- Map tiles or route renders

If no image is available:
- Render a neutral placeholder container
- Label it clearly (e.g. “Route visualization placeholder”)

---

### Icons

**Approved icon libraries only**:
- Lucide
- Heroicons (outline only)
- Tabler Icons

**Icon usage rules**:
- Icons must support data or actions
- Icons must always be paired with text
- No icon-only interfaces
- No decorative icons
- No oversized icons

---

### Maps & Visualizations

- Prefer real maps (Mapbox / Google Maps placeholders)
- Use real coordinates or realistic mock data
- If maps are unavailable:
  - Render schematic routes (lines + nodes)
- Avoid illustrative or fictional maps

---

## 7. Content & Copy Rules

- No marketing fluff
- No vague promises
- No hype language
- Prefer operational terminology:
  - Shipment
  - Carrier
  - Route
  - Capacity
  - Assignment
  - Execution
- Text must be precise and factual
- Labels over slogans

---

## 8. Homepage-Specific Guidance

The homepage must function as an **operational overview**, not a pitch deck.

Preferred homepage elements:
- Shipment lifecycle timeline
- Route execution visualization
- Capacity and assignment concepts
- Compliance, insurance, and verification proof

Avoid:
- Hero slogans
- Feature lists
- Testimonial carousels
- “Get started in 3 steps”

---

## 9. Role-Based Interface Rules

### Client Interface
- Primary focus: current shipment state
- Secondary focus: next required action
- History is accessible but not dominant

### Driver Interface
- Route visibility
- Capacity utilization
- Load constraints
- Earnings per mile
- No decorative elements

### Admin Interface
- Command-center mentality
- Tables, filters, batch actions
- Map overlays
- System-wide state visibility

---

## 10. AI Agent Instructions (Mandatory)

Any AI agent modifying UI must:

1. Read this document first
2. Follow all forbidden and required patterns
3. Use only approved visual assets
4. Avoid SaaS or startup-style layouts
5. Prefer operational clarity over aesthetics

If a generated component violates these rules, it must be rewritten.

---

## 11. Enforcement Rule

If there is a conflict between:
- Convenience and clarity  
- Aesthetic appeal and operational correctness  

**Operational correctness always wins.**

---

End of Design Constitution.
