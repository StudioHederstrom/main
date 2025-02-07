// ─────────────────────────────
// Disable browser scroll restoration to avoid interference
// ─────────────────────────────
window.history.scrollRestoration = "manual";

// ─────────────────────────────
// Global Variables & Barba Hooks for Scroll Preservation
// ─────────────────────────────

// Global variable to save the index page’s scroll position
let savedIndexScrollPosition = 0;

barba.hooks.beforeLeave(({ current }) => {
  if (current.container.getAttribute("data-barba-namespace") === "index") {
    savedIndexScrollPosition =
      window.scrollY || document.documentElement.scrollTop;
    console.log("Saved index scroll position:", savedIndexScrollPosition);
  }
});

// ─────────────────────────────
// Helper Functions
// ─────────────────────────────

function isMobileDevice() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function fadeInContainer(container) {
  // This helper ensures that the incoming container fades in smoothly,
  // which helps avoid flickering if the container was hidden or its opacity was altered.
  let isMobile = isMobileDevice();
  let delay = isMobile ? 0.3 : 0.1;
  if (!isMobile) {
    gsap.set(container, { transform: "translateZ(0)" });
  } else {
    gsap.set(container, { clearProps: "transform" });
  }
  gsap.to(container, { autoAlpha: 1, duration: 0.5, delay: delay });
}

function resetWebflow(data) {
  let parser = new DOMParser();
  let dom = parser.parseFromString(data.next.html, "text/html");
  let webflowPageId = dom.querySelector("html").getAttribute("data-wf-page");
  document.querySelector("html").setAttribute("data-wf-page", webflowPageId);
  if (window.Webflow) {
    if (window.Webflow.destroy) window.Webflow.destroy();
    if (window.Webflow.ready) window.Webflow.ready();
    if (window.Webflow.require) window.Webflow.require("ix2").init();
  }
}

// A helper to wait for a given number of animation frames.
function waitFrames(n) {
  return new Promise((resolve) => {
    function step(framesLeft) {
      if (framesLeft <= 0) {
        resolve();
      } else {
        requestAnimationFrame(() => step(framesLeft - 1));
      }
    }
    step(n);
  });
}

// ─────────────────────────────
// Transition Functions
// ─────────────────────────────

// Profile → Index Transition
// (Used for both Profile → Index and Case → Index)
async function profileToIndexTransition(data) {
  const overlayFadeDuration = 0.3; // seconds
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const profileHeight = data.current.container.offsetHeight;

  // Freeze the leaving container (profile or case)
  Object.assign(data.current.container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: `${profileHeight}px`,
    zIndex: 20,
    transform: `translateY(-${scrollTop}px)`,
    willChange: "transform, left",
  });

  // Immediately restore the saved scroll position:
  // If coming from a case page, use the saved scroll; otherwise, scroll to top.
  const leavingNamespace = data.current.container.getAttribute(
    "data-barba-namespace"
  );
  if (leavingNamespace === "case" && savedIndexScrollPosition) {
    window.scrollTo(0, savedIndexScrollPosition);
  } else {
    window.scrollTo(0, 0);
  }

  // Clone the incoming index container.
  // Leave its DOM position at top: 0 and left: 0; use transforms to offset it.
  const indexClone = data.next.container.cloneNode(true);
  Object.assign(indexClone.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: `${profileHeight}px`,
    zIndex: 10,
    opacity: 1,
    willChange: "transform",
  });
  // Initially set the clone off-screen (x: "-100%") to prevent flickering.
  if (leavingNamespace === "case" && savedIndexScrollPosition) {
    gsap.set(indexClone, { x: "-100%", y: -savedIndexScrollPosition });
  } else {
    gsap.set(indexClone, { x: "-100%", y: 0 });
  }
  document.body.appendChild(indexClone);

  // If a work overlay exists in the clone, set its starting opacity.
  const workOverlay = indexClone.querySelector(".work-overlay");
  if (workOverlay) {
    workOverlay.style.opacity = "1";
    workOverlay.style.zIndex = "15";
  }

  // Hide the actual incoming index container during the animation.
  data.next.container.style.visibility = "hidden";

  // --- Hybrid Delay Start ---
  // Use a decreased delay for larger viewports.
  const fixedDelay = window.innerWidth > 991 ? 50 : 150; // 50ms for >991px, 150ms otherwise
  const framesToWait = window.innerWidth > 991 ? 6 : 9; // 6 frames for >991px, 9 frames otherwise
  await new Promise((resolve) => setTimeout(resolve, fixedDelay));
  await waitFrames(framesToWait);
  // --- Hybrid Delay End ---

  // Instantly reposition the clone to x: "-25%" (adjustable as desired)
  gsap.set(indexClone, { x: "-25%" });

  // Set timeline defaults based on device type, with duration shortened to 0.8 seconds.
  const timelineDefaults = isMobileDevice()
    ? { ease: "expo.inOut", duration: 0.8 }
    : { ease: "expo.inOut", duration: 0.8, force3D: true };

  // Create a GSAP timeline to animate the leaving container and the clone.
  const tl = gsap.timeline({ defaults: timelineDefaults });
  // Animate the leaving container off to the right.
  tl.to(data.current.container, { left: "100%" }, 0);
  // Animate the clone from its repositioned offset (-25%) to its final position (0%).
  tl.to(indexClone, { x: "0%" }, 0);
  if (workOverlay) {
    tl.to(workOverlay, { opacity: 0, duration: overlayFadeDuration }, 0);
  }
  await tl.then();

  // Once the clone animation completes, force the window scroll to the saved position.
  window.scrollTo(
    0,
    leavingNamespace === "case" && savedIndexScrollPosition
      ? savedIndexScrollPosition
      : 0
  );

  // Remove the clone and reveal the actual incoming index container.
  indexClone.remove();
  data.next.container.style.visibility = "visible";

  console.log("Profile/Case → Index transition complete.");
}

// Index → Profile/Case Transition (unchanged)
async function indexToProfileTransition(data) {
  // Brief delay before starting the transition.
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
    window.scrollTo(0, window.scrollY - 1);
  }

  const overlayFadeDuration = 0.3; // seconds
  const indexContainer = data.current.container;
  const rect = indexContainer.getBoundingClientRect();

  // Freeze the current index container in place.
  Object.assign(indexContainer.style, {
    position: "fixed",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: 10,
    willChange: "left, transform",
  });

  const workOverlay = indexContainer.querySelector(".work-overlay");
  if (workOverlay) {
    workOverlay.style.opacity = "0";
  }

  // Determine the target namespace (profile or case) and clone the incoming container accordingly.
  const targetNamespace = data.next.container.getAttribute(
    "data-barba-namespace"
  );
  let cloneContainer;
  if (targetNamespace === "case") {
    const heroElement = data.next.container.querySelector(".hero-section");
    if (heroElement) {
      cloneContainer = document.createElement("div");
      cloneContainer.appendChild(heroElement.cloneNode(true));
      Object.assign(cloneContainer.style, {
        position: "absolute",
        top: "0",
        left: "100%", // start off-screen to the right
        width: "100%",
        height: "100%",
        zIndex: 20,
        willChange: "left, transform",
      });
      document.body.appendChild(cloneContainer);
    } else {
      cloneContainer = data.next.container.cloneNode(true);
      Object.assign(cloneContainer.style, {
        position: "absolute",
        top: "0",
        left: "100%",
        width: "100%",
        height: "100%",
        zIndex: 20,
        willChange: "left, transform",
      });
      document.body.appendChild(cloneContainer);
    }
  } else {
    cloneContainer = data.next.container.cloneNode(true);
    Object.assign(cloneContainer.style, {
      position: "absolute",
      top: "0",
      left: "100%",
      width: "100%",
      height: "100%",
      zIndex: 20,
      willChange: "left, transform",
    });
    document.body.appendChild(cloneContainer);
  }

  data.next.container.style.visibility = "hidden";

  const targetLeft = rect.left - rect.width * 0.25;
  const timelineDefaults2 = isMobileDevice()
    ? { ease: "expo.inOut", duration: 0.8 }
    : { ease: "expo.inOut", duration: 0.8, force3D: true };

  const tl2 = gsap.timeline({ defaults: timelineDefaults2 });
  tl2.to(indexContainer, { left: targetLeft }, 0);
  tl2.to(cloneContainer, { left: "0%" }, 0);
  if (workOverlay) {
    tl2.to(workOverlay, { opacity: 0.7, duration: overlayFadeDuration }, 0);
  }
  await tl2.then();

  cloneContainer.remove();
  data.next.container.style.visibility = "visible";
  window.scrollTo(0, 0);

  console.log("Index → Profile/Case transition complete.");
}

// ─────────────────────────────
// Initialize Barba Transitions
// ─────────────────────────────

function initTransitions() {
  barba.init({
    preventRunning: true,
    transitions: [
      {
        name: "profile-to-index",
        from: { namespace: ["profile"] },
        to: { namespace: ["index"] },
        async leave(data) {
          await profileToIndexTransition(data);
        },
        enter(data) {
          // For index pages, use fadeInContainer to ensure a smooth fade-in and prevent flickering.
          if (
            data.next.container.getAttribute("data-barba-namespace") === "index"
          ) {
            fadeInContainer(data.next.container);
          } else {
            gsap.to(data.next.container, {
              autoAlpha: 1,
              duration: 0.3,
              delay: 0.1,
            });
          }
          resetWebflow(data);
        },
      },
      {
        name: "index-to-profile",
        from: { namespace: ["index", "case"] },
        to: { namespace: ["profile"] },
        async leave(data) {
          await indexToProfileTransition(data);
        },
        enter(data) {
          gsap.to(data.next.container, {
            autoAlpha: 1,
            duration: 0.3,
            delay: 0.3,
          });
          resetWebflow(data);
          window.scrollTo(0, 0);
        },
      },
      {
        name: "case-to-index",
        from: { namespace: ["case"] },
        to: { namespace: ["index"] },
        async leave(data) {
          await profileToIndexTransition(data);
        },
        enter(data) {
          fadeInContainer(data.next.container);
          resetWebflow(data);
        },
      },
      {
        name: "index-to-case",
        from: { namespace: ["index"] },
        to: { namespace: ["case"] },
        async leave(data) {
          await indexToProfileTransition(data);
        },
        enter(data) {
          gsap.to(data.next.container, {
            autoAlpha: 1,
            duration: 0.3,
            delay: 0.3,
          });
          resetWebflow(data);
          window.scrollTo(0, 0);
        },
      },
    ],
  });
}

window.addEventListener("DOMContentLoaded", function () {
  initTransitions();
});
