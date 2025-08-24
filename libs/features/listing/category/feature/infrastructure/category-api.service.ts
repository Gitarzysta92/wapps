import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ICategoriesProvider } from "../application/ports";
import { Result } from "@standard";
import { CategoryDto } from "../application/models";

@Injectable()
export class CategoryApiService implements ICategoriesProvider {
  getCategries(): Observable<Result<CategoryDto[], Error>> {
    return of({
      value:  [
        {
          "id": 1,
          "name": "Work & Productivity",
          "childs": [
            {
              "id": 2,
              "name": "AI Notetakers",
              "childs": [],
              "slug": "ai-notetakers"
            },
            {
              "id": 3,
              "name": "Ad blockers",
              "childs": [],
              "slug": "ad-blockers"
            },
            {
              "id": 4,
              "name": "App switcher",
              "childs": [],
              "slug": "app-switcher"
            },
            {
              "id": 5,
              "name": "Calendar apps",
              "childs": [],
              "slug": "calendar-apps"
            },
            {
              "id": 6,
              "name": "Customer support tools",
              "childs": [],
              "slug": "customer-support-tools"
            },
            {
              "id": 7,
              "name": "E-signature apps",
              "childs": [],
              "slug": "e-signature-apps"
            },
            {
              "id": 8,
              "name": "Email clients",
              "childs": [],
              "slug": "email-clients"
            },
            {
              "id": 9,
              "name": "File storage and sharing apps",
              "childs": [],
              "slug": "file-storage-and-sharing-apps"
            },
            {
              "id": 10,
              "name": "Hiring software",
              "childs": [],
              "slug": "hiring-software"
            },
            {
              "id": 11,
              "name": "Knowledge base software",
              "childs": [],
              "slug": "knowledge-base-software"
            },
            {
              "id": 12,
              "name": "Legal services",
              "childs": [],
              "slug": "legal-services"
            },
            {
              "id": 13,
              "name": "Meeting software",
              "childs": [],
              "slug": "meeting-software"
            },
            {
              "id": 14,
              "name": "Note and writing apps",
              "childs": [],
              "slug": "note-and-writing-apps"
            },
            {
              "id": 15,
              "name": "PDF Editor",
              "childs": [],
              "slug": "pdf-editor"
            },
            {
              "id": 16,
              "name": "Password managers",
              "childs": [],
              "slug": "password-managers"
            },
            {
              "id": 17,
              "name": "Presentation Software",
              "childs": [],
              "slug": "presentation-software"
            },
            {
              "id": 18,
              "name": "Product demo",
              "childs": [],
              "slug": "product-demo"
            },
            {
              "id": 19,
              "name": "Project management software",
              "childs": [],
              "slug": "project-management-software"
            },
            {
              "id": 20,
              "name": "Resume tools",
              "childs": [],
              "slug": "resume-tools"
            },
            {
              "id": 21,
              "name": "Scheduling software",
              "childs": [],
              "slug": "scheduling-software"
            },
            {
              "id": 22,
              "name": "Screenshots and screen recording apps",
              "childs": [],
              "slug": "screenshots-and-screen-recording-apps"
            },
            {
              "id": 23,
              "name": "Search",
              "childs": [],
              "slug": "search"
            },
            {
              "id": 24,
              "name": "Spreadsheets",
              "childs": [],
              "slug": "spreadsheets"
            },
            {
              "id": 25,
              "name": "Team collaboration software",
              "childs": [],
              "slug": "team-collaboration-software"
            },
            {
              "id": 26,
              "name": "Time tracking apps",
              "childs": [],
              "slug": "time-tracking-apps"
            },
            {
              "id": 27,
              "name": "Video conferencing",
              "childs": [],
              "slug": "video-conferencing"
            },
            {
              "id": 28,
              "name": "Virtual office platforms",
              "childs": [],
              "slug": "virtual-office-platforms"
            },
            {
              "id": 29,
              "name": "Web browsers",
              "childs": [],
              "slug": "web-browsers"
            },
            {
              "id": 30,
              "name": "Writing assistants",
              "childs": [],
              "slug": "writing-assistants"
            }
          ],
          "slug": "work-productivity"
        },
        {
          "id": 31,
          "name": "Engineering & Development",
          "childs": [
            {
              "id": 32,
              "name": "A/B testing tools",
              "childs": [],
              "slug": "a-b-testing-tools"
            },
            {
              "id": 33,
              "name": "AI Coding Assistants",
              "childs": [],
              "slug": "ai-coding-assistants"
            },
            {
              "id": 34,
              "name": "Authentication & identity tools",
              "childs": [],
              "slug": "authentication-identity-tools"
            },
            {
              "id": 35,
              "name": "Automation tools",
              "childs": [],
              "slug": "automation-tools"
            },
            {
              "id": 36,
              "name": "Content Management Systems",
              "childs": [],
              "slug": "content-management-systems"
            },
            {
              "id": 37,
              "name": "Cloud Computing Platforms",
              "childs": [],
              "slug": "cloud-computing-platforms"
            },
            {
              "id": 38,
              "name": "Code Review Tools",
              "childs": [],
              "slug": "code-review-tools"
            },
            {
              "id": 39,
              "name": "Code editors",
              "childs": [],
              "slug": "code-editors"
            },
            {
              "id": 40,
              "name": "Command line tools",
              "childs": [],
              "slug": "command-line-tools"
            },
            {
              "id": 41,
              "name": "Data analysis tools",
              "childs": [],
              "slug": "data-analysis-tools"
            },
            {
              "id": 42,
              "name": "Data visualization tools",
              "childs": [],
              "slug": "data-visualization-tools"
            },
            {
              "id": 43,
              "name": "Databases and backend frameworks",
              "childs": [],
              "slug": "databases-and-backend-frameworks"
            },
            {
              "id": 44,
              "name": "Git clients",
              "childs": [],
              "slug": "git-clients"
            },
            {
              "id": 45,
              "name": "Headless CMS software",
              "childs": [],
              "slug": "headless-cms-software"
            },
            {
              "id": 46,
              "name": "Issue tracking software",
              "childs": [],
              "slug": "issue-tracking-software"
            },
            {
              "id": 47,
              "name": "Membership software",
              "childs": [],
              "slug": "membership-software"
            },
            {
              "id": 48,
              "name": "No-code platforms",
              "childs": [],
              "slug": "no-code-platforms"
            },
            {
              "id": 49,
              "name": "Security & compliance tools",
              "childs": [],
              "slug": "security-compliance-tools"
            },
            {
              "id": 50,
              "name": "Standup bots",
              "childs": [],
              "slug": "standup-bots"
            },
            {
              "id": 51,
              "name": "Static site generators",
              "childs": [],
              "slug": "static-site-generators"
            },
            {
              "id": 52,
              "name": "Testing and QA software",
              "childs": [],
              "slug": "testing-and-qa-software"
            },
            {
              "id": 53,
              "name": "Unified API",
              "childs": [],
              "slug": "unified-api"
            },
            {
              "id": 54,
              "name": "VPN client",
              "childs": [],
              "slug": "vpn-client"
            },
            {
              "id": 55,
              "name": "Video hosting platforms",
              "childs": [],
              "slug": "video-hosting-platforms"
            },
            {
              "id": 56,
              "name": "Web hosting services",
              "childs": [],
              "slug": "web-hosting-services"
            },
            {
              "id": 57,
              "name": "Website analytics",
              "childs": [],
              "slug": "website-analytics"
            },
            {
              "id": 58,
              "name": "Website builders",
              "childs": [],
              "slug": "website-builders"
            }
          ],
          "slug": "engineering-development"
        },
        {
          "id": 59,
          "name": "Design & Creative",
          "childs": [
            {
              "id": 60,
              "name": "3D & Animation",
              "childs": [],
              "slug": "3d-animation"
            },
            {
              "id": 61,
              "name": "Background removal tools",
              "childs": [],
              "slug": "background-removal-tools"
            },
            {
              "id": 62,
              "name": "Camera apps",
              "childs": [],
              "slug": "camera-apps"
            },
            {
              "id": 63,
              "name": "Design inspiration websites",
              "childs": [],
              "slug": "design-inspiration-websites"
            },
            {
              "id": 64,
              "name": "Design mockups",
              "childs": [],
              "slug": "design-mockups"
            },
            {
              "id": 65,
              "name": "Design resources",
              "childs": [],
              "slug": "design-resources"
            },
            {
              "id": 66,
              "name": "Digital whiteboards",
              "childs": [],
              "slug": "digital-whiteboards"
            },
            {
              "id": 67,
              "name": "Graphic design tools",
              "childs": [],
              "slug": "graphic-design-tools"
            },
            {
              "id": 68,
              "name": "Icon sets",
              "childs": [],
              "slug": "icon-sets"
            },
            {
              "id": 69,
              "name": "Interface design tools",
              "childs": [],
              "slug": "interface-design-tools"
            },
            {
              "id": 70,
              "name": "Mobile editing apps",
              "childs": [],
              "slug": "mobile-editing-apps"
            },
            {
              "id": 71,
              "name": "Photo editing",
              "childs": [],
              "slug": "photo-editing"
            },
            {
              "id": 72,
              "name": "Podcasting",
              "childs": [],
              "slug": "podcasting"
            },
            {
              "id": 73,
              "name": "Social audio apps",
              "childs": [],
              "slug": "social-audio-apps"
            },
            {
              "id": 74,
              "name": "Space design apps",
              "childs": [],
              "slug": "space-design-apps"
            },
            {
              "id": 75,
              "name": "Stock photo sites",
              "childs": [],
              "slug": "stock-photo-sites"
            },
            {
              "id": 76,
              "name": "UI frameworks",
              "childs": [],
              "slug": "ui-frameworks"
            },
            {
              "id": 77,
              "name": "User research",
              "childs": [],
              "slug": "user-research"
            },
            {
              "id": 78,
              "name": "Video editing",
              "childs": [],
              "slug": "video-editing"
            },
            {
              "id": 79,
              "name": "Wallpapers",
              "childs": [],
              "slug": "wallpapers"
            },
            {
              "id": 80,
              "name": "Wireframing",
              "childs": [],
              "slug": "wireframing"
            }
          ],
          "slug": "design-creative"
        },
        {
          "id": 81,
          "name": "Finance",
          "childs": [
            {
              "id": 82,
              "name": "Accounting software",
              "childs": [],
              "slug": "accounting-software"
            },
            {
              "id": 83,
              "name": "Budgeting apps",
              "childs": [],
              "slug": "budgeting-apps"
            },
            {
              "id": 84,
              "name": "Credit score tools",
              "childs": [],
              "slug": "credit-score-tools"
            },
            {
              "id": 85,
              "name": "Financial planning",
              "childs": [],
              "slug": "financial-planning"
            },
            {
              "id": 86,
              "name": "Fundraising resources",
              "childs": [],
              "slug": "fundraising-resources"
            },
            {
              "id": 87,
              "name": "Investing",
              "childs": [],
              "slug": "investing"
            },
            {
              "id": 88,
              "name": "Invoicing tools",
              "childs": [],
              "slug": "invoicing-tools"
            },
            {
              "id": 89,
              "name": "Money transfer",
              "childs": [],
              "slug": "money-transfer"
            },
            {
              "id": 90,
              "name": "Neobanks",
              "childs": [],
              "slug": "neobanks"
            },
            {
              "id": 91,
              "name": "Online banking",
              "childs": [],
              "slug": "online-banking"
            },
            {
              "id": 92,
              "name": "Payroll software",
              "childs": [],
              "slug": "payroll-software"
            },
            {
              "id": 93,
              "name": "Remote workforce tools",
              "childs": [],
              "slug": "remote-workforce-tools"
            },
            {
              "id": 94,
              "name": "Retirement planning",
              "childs": [],
              "slug": "retirement-planning"
            },
            {
              "id": 95,
              "name": "Savings apps",
              "childs": [],
              "slug": "savings-apps"
            },
            {
              "id": 96,
              "name": "Startup financial planning",
              "childs": [],
              "slug": "startup-financial-planning"
            },
            {
              "id": 97,
              "name": "Stock trading platforms",
              "childs": [],
              "slug": "stock-trading-platforms"
            },
            {
              "id": 98,
              "name": "Tax preparation",
              "childs": [],
              "slug": "tax-preparation"
            },
            {
              "id": 99,
              "name": "Treasury management platforms",
              "childs": [],
              "slug": "treasury-management-platforms"
            }
          ],
          "slug": "finance"
        },
        {
          "id": 100,
          "name": "Social & Community",
          "childs": [
            {
              "id": 101,
              "name": "Blogging platforms",
              "childs": [],
              "slug": "blogging-platforms"
            },
            {
              "id": 102,
              "name": "Community management",
              "childs": [],
              "slug": "community-management"
            },
            {
              "id": 103,
              "name": "Dating apps",
              "childs": [],
              "slug": "dating-apps"
            },
            {
              "id": 104,
              "name": "Link in bio tools",
              "childs": [],
              "slug": "link-in-bio-tools"
            },
            {
              "id": 105,
              "name": "Live streaming platforms",
              "childs": [],
              "slug": "live-streaming-platforms"
            },
            {
              "id": 106,
              "name": "Messaging apps",
              "childs": [],
              "slug": "messaging-apps"
            },
            {
              "id": 107,
              "name": "Microblogging platforms",
              "childs": [],
              "slug": "microblogging-platforms"
            },
            {
              "id": 108,
              "name": "Newsletter platforms",
              "childs": [],
              "slug": "newsletter-platforms"
            },
            {
              "id": 109,
              "name": "Photo sharing",
              "childs": [],
              "slug": "photo-sharing"
            },
            {
              "id": 110,
              "name": "Professional networking platforms",
              "childs": [],
              "slug": "professional-networking-platforms"
            },
            {
              "id": 111,
              "name": "Safety and Privacy platforms",
              "childs": [],
              "slug": "safety-and-privacy-platforms"
            },
            {
              "id": 112,
              "name": "Social Networking",
              "childs": [],
              "slug": "social-networking"
            },
            {
              "id": 113,
              "name": "Social bookmarking",
              "childs": [],
              "slug": "social-bookmarking"
            },
            {
              "id": 114,
              "name": "Video and Voice calling",
              "childs": [],
              "slug": "video-and-voice-calling"
            }
          ],
          "slug": "social-community"
        },
        {
          "id": 115,
          "name": "Marketing & Sales",
          "childs": [
            {
              "id": 116,
              "name": "Advertising tools",
              "childs": [],
              "slug": "advertising-tools"
            },
            {
              "id": 117,
              "name": "Affiliate marketing",
              "childs": [],
              "slug": "affiliate-marketing"
            },
            {
              "id": 118,
              "name": "Best SEO tools",
              "childs": [],
              "slug": "best-seo-tools"
            },
            {
              "id": 119,
              "name": "Business intelligence software",
              "childs": [],
              "slug": "business-intelligence-software"
            },
            {
              "id": 120,
              "name": "CRM software",
              "childs": [],
              "slug": "crm-software"
            },
            {
              "id": 121,
              "name": "Customer loyalty platforms",
              "childs": [],
              "slug": "customer-loyalty-platforms"
            },
            {
              "id": 122,
              "name": "Email marketing",
              "childs": [],
              "slug": "email-marketing"
            },
            {
              "id": 123,
              "name": "Influencer marketing platforms",
              "childs": [],
              "slug": "influencer-marketing-platforms"
            },
            {
              "id": 124,
              "name": "Keyword research tools",
              "childs": [],
              "slug": "keyword-research-tools"
            },
            {
              "id": 125,
              "name": "Landing page builders",
              "childs": [],
              "slug": "landing-page-builders"
            },
            {
              "id": 126,
              "name": "Lead generation software",
              "childs": [],
              "slug": "lead-generation-software"
            },
            {
              "id": 127,
              "name": "Marketing automation platforms",
              "childs": [],
              "slug": "marketing-automation-platforms"
            },
            {
              "id": 128,
              "name": "Sales Training",
              "childs": [],
              "slug": "sales-training"
            },
            {
              "id": 129,
              "name": "Social media management tools",
              "childs": [],
              "slug": "social-media-management-tools"
            },
            {
              "id": 130,
              "name": "Social media scheduling tools",
              "childs": [],
              "slug": "social-media-scheduling-tools"
            },
            {
              "id": 131,
              "name": "Survey and form builders",
              "childs": [],
              "slug": "survey-and-form-builders"
            }
          ],
          "slug": "marketing-sales"
        },
        {
          "id": 132,
          "name": "AI",
          "childs": [
            {
              "id": 133,
              "name": "AI Characters",
              "childs": [],
              "slug": "ai-characters"
            },
            {
              "id": 134,
              "name": "AI Chatbots",
              "childs": [],
              "slug": "ai-chatbots"
            },
            {
              "id": 135,
              "name": "AI Content Detection",
              "childs": [],
              "slug": "ai-content-detection"
            },
            {
              "id": 136,
              "name": "AI Databases",
              "childs": [],
              "slug": "ai-databases"
            },
            {
              "id": 137,
              "name": "AI Generative Art",
              "childs": [],
              "slug": "ai-generative-art"
            },
            {
              "id": 138,
              "name": "AI Headshot Generators",
              "childs": [],
              "slug": "ai-headshot-generators"
            },
            {
              "id": 139,
              "name": "AI Infrastructure Tools",
              "childs": [],
              "slug": "ai-infrastructure-tools"
            },
            {
              "id": 140,
              "name": "AI Metrics and Evaluation",
              "childs": [],
              "slug": "ai-metrics-and-evaluation"
            },
            {
              "id": 141,
              "name": "AI Voice Generation Software",
              "childs": [],
              "slug": "ai-voice-generation-software"
            },
            {
              "id": 142,
              "name": "Avatar generators",
              "childs": [],
              "slug": "avatar-generators"
            },
            {
              "id": 143,
              "name": "ChatGPT Prompts",
              "childs": [],
              "slug": "chatgpt-prompts"
            },
            {
              "id": 144,
              "name": "LLMs",
              "childs": [],
              "slug": "llms"
            },
            {
              "id": 145,
              "name": "Predictive AI",
              "childs": [],
              "slug": "predictive-ai"
            },
            {
              "id": 146,
              "name": "Text-to-Speech",
              "childs": [],
              "slug": "text-to-speech"
            }
          ],
          "slug": "ai"
        },
        {
          "id": 147,
          "name": "Health & Fitness",
          "childs": [
            {
              "id": 148,
              "name": "Activity tracking",
              "childs": [],
              "slug": "activity-tracking"
            },
            {
              "id": 149,
              "name": "Camping apps",
              "childs": [],
              "slug": "camping-apps"
            },
            {
              "id": 150,
              "name": "Health Insurance",
              "childs": [],
              "slug": "health-insurance"
            },
            {
              "id": 151,
              "name": "Hiking apps",
              "childs": [],
              "slug": "hiking-apps"
            },
            {
              "id": 152,
              "name": "Medical",
              "childs": [],
              "slug": "medical"
            },
            {
              "id": 153,
              "name": "Meditation apps",
              "childs": [],
              "slug": "meditation-apps"
            },
            {
              "id": 154,
              "name": "Mental Health",
              "childs": [],
              "slug": "mental-health"
            },
            {
              "id": 155,
              "name": "Senior care",
              "childs": [],
              "slug": "senior-care"
            },
            {
              "id": 156,
              "name": "Sleep apps",
              "childs": [],
              "slug": "sleep-apps"
            },
            {
              "id": 157,
              "name": "Therapy apps",
              "childs": [],
              "slug": "therapy-apps"
            },
            {
              "id": 158,
              "name": "Workout platforms",
              "childs": [],
              "slug": "workout-platforms"
            }
          ],
          "slug": "health-fitness"
        },
        {
          "id": 159,
          "name": "Travel",
          "childs": [
            {
              "id": 160,
              "name": "Flight booking apps",
              "childs": [],
              "slug": "flight-booking-apps"
            },
            {
              "id": 161,
              "name": "Hotel booking app",
              "childs": [],
              "slug": "hotel-booking-app"
            },
            {
              "id": 162,
              "name": "Maps and GPS",
              "childs": [],
              "slug": "maps-and-gps"
            },
            {
              "id": 163,
              "name": "Outdoors platforms",
              "childs": [],
              "slug": "outdoors-platforms"
            },
            {
              "id": 164,
              "name": "Short term rentals",
              "childs": [],
              "slug": "short-term-rentals"
            },
            {
              "id": 165,
              "name": "Travel Insurance",
              "childs": [],
              "slug": "travel-insurance"
            },
            {
              "id": 166,
              "name": "Travel Planning",
              "childs": [],
              "slug": "travel-planning"
            },
            {
              "id": 167,
              "name": "Travel apps",
              "childs": [],
              "slug": "travel-apps"
            },
            {
              "id": 168,
              "name": "Weather apps",
              "childs": [],
              "slug": "weather-apps"
            }
          ],
          "slug": "travel"
        },
        {
          "id": 169,
          "name": "Web3",
          "childs": [
            {
              "id": 170,
              "name": "Crypto exchanges",
              "childs": [],
              "slug": "crypto-exchanges"
            },
            {
              "id": 171,
              "name": "Crypto tools",
              "childs": [],
              "slug": "crypto-tools"
            },
            {
              "id": 172,
              "name": "Crypto wallets",
              "childs": [],
              "slug": "crypto-wallets"
            },
            {
              "id": 173,
              "name": "DAOs",
              "childs": [],
              "slug": "daos"
            },
            {
              "id": 174,
              "name": "Defi",
              "childs": [],
              "slug": "defi"
            },
            {
              "id": 175,
              "name": "NFT creation tools",
              "childs": [],
              "slug": "nft-creation-tools"
            },
            {
              "id": 176,
              "name": "NFT marketplaces",
              "childs": [],
              "slug": "nft-marketplaces"
            }
          ],
          "slug": "web3"
        },
        {
          "id": 177,
          "name": "Ecommerce",
          "childs": [
            {
              "id": 178,
              "name": "Ecommerce platforms",
              "childs": [],
              "slug": "ecommerce-platforms"
            },
            {
              "id": 179,
              "name": "Marketplace sites",
              "childs": [],
              "slug": "marketplace-sites"
            },
            {
              "id": 180,
              "name": "Payment processors",
              "childs": [],
              "slug": "payment-processors"
            },
            {
              "id": 181,
              "name": "Shopify Apps",
              "childs": [],
              "slug": "shopify-apps"
            }
          ],
          "slug": "ecommerce"
        }
      ]
    })
  }
}