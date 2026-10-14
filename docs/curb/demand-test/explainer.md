Status: DRAFT. Synthetic example. Not legal advice.

# Curb in one page

**The problem.** An AI services agreement often says customer data may go only to named model providers ("only Anthropic"). Checking that the vendor's code obeys it is slow manual work, and nobody can show how they checked.

**What Curb does.** It scans a snapshot of a code repository for references to AI providers and compares them with the providers a named person confirmed the agreement allows. The scan is a fixed set of rules. There is no AI model in the verdict, so the same inputs always give the same result.

**Input**
1. The agreement text.
2. A person's confirmation: the quote from the agreement and the list of allowed providers, with their name.
3. The code, frozen at one commit.

**Process.** The scanner reads TypeScript and JavaScript files. It looks for imports of provider packages, web addresses of provider APIs, model names that carry a provider prefix (such as `openai/gpt-5`), and values assigned to names like `provider`. Anything it cannot judge (unreadable, minified or very large files, or a file that is mostly a list of model names) is listed as unknown.

**Output.** A report with one of three results:
- **FAIL**: at least one reference to a provider that is not allowed. Each one shows the file, the line and the exact text.
- **PASS**: nothing outside the allowed list was found in the code that was scanned.
- **UNKNOWN**: something could not be checked, and the report lists what.

It opens with what it covers and what it does not claim. After a fix, a rerun shows what was fixed, what is new and what is unchanged.

**What it does not claim.** It does not say where data goes at runtime, what a provider does with it, whether unused code matters, or whether the allowed list matches the signed agreement. A PASS means "no reference found in the code that was scanned". It is not legal advice or a compliance certification.

**Known weak spots** (so you can judge it fairly)
- It only reads TypeScript and JavaScript. Configuration files, other languages and runtime settings are not scanned.
- A provider reached through a proxy, a wrapper it does not know, or a name built at runtime can be missed. On one of three public repositories it missed a wrapper library entirely; that gap is filed and not yet fixed.
- The rule set that defines "an unapproved provider reference" is a draft and has not been approved by counsel.

**Where it is.** A command-line tool. Nothing you will see today is a finished interface; the question is whether this output is worth putting in one.
