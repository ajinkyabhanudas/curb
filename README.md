# curb

Curb checks a human-confirmed contract commitment, such as a limit on which AI model providers may receive customer content, against a source repository and reports the evidence. It is not legal advice or a compliance certification.

## Status

V1 vertical slice (engine); frontend/ holds the earlier form-to-PDF prototype, kept for reference and not part of the verifier.

## Setup

```
cd engine && npm install && npm test
```

Requires Node >= 24.

## Usage

See [engine/README.md](engine/README.md) for the CLI, a reproducible demo, result states and the trust model. Design and decision documents are in [docs/curb/](docs/curb/).

## Third-party content

The agreements in `templates/` are unmodified copies from [Common Paper](https://github.com/CommonPaper), used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [templates/LICENSE.txt](templates/LICENSE.txt).

## License

Released under the [MIT License](LICENSE).
