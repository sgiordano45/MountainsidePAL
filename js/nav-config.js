/* Single source of truth for site navigation, contacts and links.
 * `built: false` renders the link dimmed, pointing at a stub page,
 * so the nav is complete from day one without dead 404s.
 */

export const SITE = {
  name: "Mountainside PAL",
  program: "Travel Basketball",
  grades: "Grades 3–8",

  registrationUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLSe-KBrx3TRDZA4Z8tgt1Him2eN_BMvPDe7qXtFdd307UYub0Q/viewform",

  instagram: {
    handle: "@Mountainsidebasketball10",
    url: "https://www.instagram.com/mountainsidebasketball10/"
  },

  // First entry is the primary contact used in FAQ answers and CTAs.
  contacts: [
    {
      name:  "Giovanni Cerullo",
      role:  "Program Contact",          // confirm exact title with PAL
      email: "Mountainsidetravelbasketball@gmail.com",
      phone: "+1 (908) 603-9665",
      tel:   "+19086039665"
    },
    {
      name:  "Paul Mirabelli",
      role:  "Mayor, Borough of Mountainside",
      email: "pmirabelli@verizon.net",
      phone: "(908) 461-9070",
      tel:   "+19084619070"
    }
  ]
};

/** Primary contact shortcut. */
export const PRIMARY = SITE.contacts[0];

export const NAV = [
  { href: "index.html",         label: "Home",          built: true  },
  { href: "register.html",      label: "Register",      built: true  },
  { href: "program.html",       label: "Program Info",  built: true  },
  { href: "schedule.html",      label: "Schedule",      built: true  },
  { href: "teams.html",         label: "Teams",         built: true  },
  { href: "coaches.html",       label: "Coaches",       built: true  },
  { href: "announcements.html", label: "Announcements", built: true  }
];
