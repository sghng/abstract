# Writing Slides

Now that we have the `story.md` outlined, we may start writing the slides. Let's
stick to the plan, and make sure our presentation is always coherent and
cohesive.

## Basics

- We use Typst with `touying` package to create our slideshow.
- For Typst syntax conventions and common pitfalls, also read `../typst.md`.
- You are welcome to use CeTZ, Fletcher, and Lilaq to create visualizations when
  they are helpful for conveying the content.
- When in doubt, you're welcome to invoke doc search via `context7` MCP tool.
- We default to the latest version. Use featured Typst packages when needed.
- Conventionally, we import all variables in `touying` and the selected theme
  namespace when making a slides.
- If the talk is short/casual, no need to adopt the full boiler plate from the
  template! For example, we don't have to section headers, if the talk is short.

## Styling

> [!WARNING]
>
> We keep things minimalistic to begin with. The first iteration of the slides
> should be of minimal styling (except for base styling from the theme and Typst
> itself). Do not add animations in the initial iterations until user asks you
> to. After the first draft is done, suggest to user that we can add styles and
> animations.

We default to the `university` theme.

> [!WARNING]
>
> Due to the known constraint of `university` theme, the title of sections and
> slides shouldn't be too long, otherwise text would crowd together. Keep the
> title of section under 3 words. Keep the title of slide under 10 words. The
> more concise the better.

When styling the slides per the request of the user, the following things are to
be considered:

> [!IMPORTANT]
>
> - Use Typst/theme builtin styling as much as possible.
> - If you have to apply custom styling, such as color, font size, etc., do not
>   use inline styling, instead, use design tokens. For example, by defining
>   variables such as `color-emphasis`, `font-large`, `font-small`.
> - Avoid inline styling as much as possible. Use Typst native `set` syntax if a
>   styling applies to all slides.

## Example

- `touying.typ` is a more complex example of Touying, taken from official
  documentation. This is only a functional reference, it doesn't mean you should
  also always generate such complex slides.
- `university.typ` is an example of the `university` theme of Touying.
