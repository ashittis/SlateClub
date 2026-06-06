Don't ask Claude Code to "make it look like this."

Ask it to implement the **motion language**, **animation system**, and **interaction model**.

The references you attached are not SVG-heavy animations. They're mostly:

* Layered card transforms
* Depth/parallax
* 3D perspective
* Shared element transitions
* Motion blur
* Dynamic scaling
* Spring physics
* Gradient lighting
* Glassmorphism overlays
* Continuous ambient motion

For your Letterboxd × Spotify app, I'd give Claude something like this:

You are a senior iOS/Android motion designer and React Native engineer.

I do NOT want generic mobile animations.

Study the attached references and implement the same motion philosophy.

ANIMATION STYLE

* Premium streaming app feel
* Apple TV + Spotify + Letterboxd hybrid
* Heavy depth
* Strong hierarchy
* Physical motion
* Real spring dynamics
* No standard SVG animations
* No Lottie
* No floating icons
* No generic fade-ins

MOTION PRINCIPLES

1. Card Depth

* Every movie card exists in 3D space
* Cards rotate slightly during horizontal scroll
* Scale changes based on distance from center
* Opacity changes subtly
* Dynamic shadow interpolation

2. Shared Element Transitions
   When opening a movie:

* Poster morphs into detail page
* Title animates position
* Backdrop expands smoothly
* Metadata fades in after expansion
* Duration 450-650ms
* Spring based

3. Spotify-style Background

* Full-screen backdrop image
* Blurred version behind content
* Dynamic gradient overlay
* Background slowly drifts (parallax)
* Never static

4. Scroll Physics

Horizontal movie rail:

Center card:
scale = 1

Adjacent:
scale = 0.92

Far cards:
scale = 0.84

Perspective rotation:
rotateY up to ±15°

5. Dynamic Lighting

As user scrolls:

* Poster glow follows active card
* Soft radial light behind card
* Opacity interpolated from card position

6. Glass Components

Use:
backdrop blur
transparent layers
noise texture

Avoid:
solid white cards
flat containers

7. Music Integration

When soundtrack is playing:

* Poster subtly pulses with BPM
* Background gradient reacts to dominant colors
* Playback progress controls micro-animation timing

8. Movie Detail Screen

Animation sequence:

1. Poster expands

2. Backdrop fades in

3. Metadata slides up

4. Cast cards stagger

5. Reviews cascade

6. Floating CTA appears last

7. Performance Requirements

* 60fps minimum
* GPU accelerated transforms
* No layout thrashing
* Reanimated 3
* Gesture Handler
* Skia where beneficial
* SharedTransition API

TECH STACK

React Native
Reanimated 3
Gesture Handler
React Navigation
Skia

Generate production-ready code.

Do not use placeholder animations.

Implement cinematic motion similar to premium entertainment apps.

### Even better: describe the exact effects from your references

The first image uses:

* Large hero poster
* Dark cinematic backdrop
* Ticket/card expansion
* Glass overlays
* Scale + depth transitions
* Layered z-index movement

The second image uses:

* CoverFlow-style carousel
* Center-focused scaling
* Perspective rotation
* Momentum scrolling
* Active card prominence

For Letterboxd + Spotify, I'd combine:

**Home**

* CoverFlow movie carousel
* Active soundtrack playing in background
* Live blurred artwork backdrop

**Movie Details**

* Shared element transition
* Spotify-style expanding artwork
* Dynamic color extraction from poster
* Animated review cards

**Player**

* Vinyl-inspired rotation
* Cinematic backdrop
* Depth-based controls

This is the kind of prompt that gets Claude Code to build a premium streaming-app motion system instead of adding generic Framer Motion fades everywhere.
