import { createRequire } from "node:module"
import axios from "axios"
import fs from "node:fs"

const require = createRequire(import.meta.url)
const unpdf = require("unpdf")

const PDF_URL =
"https://upsc.gov.in/sites/default/files/AnsKey-CSP-2023-Paper-I-090524.pdf"

const OUT_FILE =
"data/pyq/upsc_answer_key_2023_gs1.json"

const SETS = ["A", "B", "C", "D"] as const

function parseSet(section: string) {
  const regex = /(\d{1,3})\s*([ABCDX])/g
  const answers: Record<number, string | null> = {}
  let match: RegExpExecArray | null

  while ((match = regex.exec(section)) !== null) {
    const q = Number(match[1])
    const ans = match[2]

    if (q >= 1 && q <= 100 && ans) {
      answers[q] = ans === "X" ? null : ans
    }
  }

  return answers
}

async function main() {
  console.log("Downloading UPSC answer key...")

  const res = await axios.get<ArrayBuffer>(PDF_URL, { responseType: "arraybuffer" })

  const { text } = await unpdf.default(Buffer.from(res.data))

  const sections = text.split(/SET\s*[ABCD]/i)

  if (sections.length < 5) {
    throw new Error("Could not detect answer sets")
  }

  const result: Record<number, Partial<Record<(typeof SETS)[number], string | null>>> = {}

  for (let i = 1; i <= 4; i++) {
    const set = SETS[i - 1]
    const section = sections[i]
    if (!set || !section) {
      continue
    }
    const parsed = parseSet(section)

    for (const q in parsed) {
      const qn = Number(q)
      if (!result[qn]) {
        result[qn] = {}
      }
      result[qn][set] = parsed[qn]
    }
  }

  fs.mkdirSync("data/pyq", { recursive: true })

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(result, null, 2)
  )

  console.log("Extracted", Object.keys(result).length, "questions")
}

main().catch(console.error)
