# Outside world: the designer's words (verbatim), 2026-11-27

These are the designer's messages that started this workstream, copied verbatim. The spec is
[OUTSIDE-WORLD.md](OUTSIDE-WORLD.md). When the spec and these words disagree, these words win; then fix the spec.

## 1. The question

> i want to understand how US and China governments (not the labs) work in the game, why we care about them. also how
> the public population works, the economy, outside world, relations, things in relations and world tabs
>
> in general, i want the outside world (outside of the player's company) to be a very simplified and lightly simulated
> and easily calibrated system. we started doing that for the rival labs (not yet totally happy with it - i think a bit
> to complex still). so i am trying to understand what we have now, and what we need the outside world for in the game.
> in what ways does the outside world affect the lab, and what is the minimal way to properly simulate that, just
> enough to provide the correct shape and choices.
>
> and a related side point, we currently have way too many events, decisions, too many fake events and 1-click
> decisions that dont make sense. i would prefer to have those also, simplified and the minimal needed
>
> explain to me

## 2. The framing

> so we have customers (product markets), investors (finance markets), hiring (labor markets). we have rival labs
> (including china's). we have geopolitical powers (US and China governments). we have the general public, the global
> economy. anyone we are missing? i feel like this is a better framing? i wrote them in order of significance to game
> play in my mind (and how much i care they are good vs simple)
>
> i think most of what we currently have is garbage, slop, junk, bloat, spam (i really mean these words - not just as
> insults).
>
> i want the outside world to be simple, easily calibrated, yet reponsive enough to the player's game to have meaning
> (so no things like 'US government worried' if the player is so bad that he has no advanced model - this is just an
> example)

## 3. The ranks and the plan

> yes, compute and power markets, and debt markets i folded into investors (though they are slightly different of
> course, same idea).
> so we have:
> top rank: finance markets (investors, debt), compute markets (chips, power), products markets (customers)
> second rank: labor markets (hiring)
> third rank: rival labs, goverments
> fourth rank: public, economy
>
> not everything here is actors per-say. the top and second ranks are more just markets that the player and the other
> actors work in, and the markets just need to be defined well enough to produce the correct behvior in response to
> the actors (yet simplified)
>
> we have first versions of the finance, compute, product, labor markets, and a first version of the rival labs.
> i think what we need is to remove the junk, build the goverments public and economy and then see how everything
> interacts

## 4. Answers to the lead's four questions

The questions were: (1) keep the endings tied to these actors (nationalised, war, treaty, world-outcome scoring)?
(2) world technologies and robots: keep reduced, or junk? (3) evaluators and the Safety Index: fold into "what
outsiders see of you", or cut? (4) the parallel calibration work on `bal`: own branch, merge at a checkpoint, or wait?

> 1. keep them
> 2, i think world technologies and robots are a nice flavor (even if for now most dont come - we plan in future to
> have a post-ASI world), so keep all
> 3. either fold or cut
> 4. the calibration will continue by itself, it mostly is focused on internal calibration, and will continue
> regardless of us. we will focus on the external world here, and once both halfs work we will make sure they work
> together, but that is later work.
