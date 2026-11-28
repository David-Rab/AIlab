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

## 5. Answers to spec §13, and the acceptance test

> ok, sounds good.
> answers:
> 1. ok
> 2. yes, if not too complicated, otherwise drop
> 3. ok
> 4. one approval
> 5. ok
>
> lets build it, and then the test will be a world without a player and see what happen in each timeline. sounds good?

## 6. Calibration frame

> i want to point out - we are using the AI futures models - not the AI27 (see the balance work and timelines)

## 7. Sweep AI 2027; setup cleanup

> part of this session will be to sweep that away as well - to make sure we align with reality (up to november 2026)
> and then AI futures predictions (according to the timelines).
> since we are talking about this, in game setup - what is the difference between baseline and timeline? probably one
> should go.
> and we will need to cleanup the rest of the game setup that is related to this (government, public, china, economy,
> storyteller (should that go as junk?))

## 8. Milestones achieved in the game; AI 2027 as inspiration

> and i don't want to be tied to the milestone dates in the timelines themselves - rather to the milestones that are
> achieved in the game, and the rivals will (the lead lab of them) will need to be aligned with the timelines
> milestones (calibrated)
>
> we can still totally be inspired by AI27 for things like the order of the US gov reactions and options and events
> and things.

## 9. Plans A–D; baseline; scope

> also AI futures plan A B and so on (we should read up on them) should be an inspiration (we should have enough in
> the game to be able to implement those plans in theory if things work out)
>
> we dont want the baseline to have options anymore - just reality up to late 2026.

> this session isn't supposed to really do much about the player's lab - mostly fix up the outside worl. so only list
> them and hand to the balance work when we merge

## 10. Refocus

> ok.
> i think i let myself spread out a bit on what i want to do this session - i think we need to atleast refocus on what
> we want, to make sure we are aligned

The lead's summary, which the designer accepted ("good, we seem aligned"):
- **Goal:** replace the junk outside world (governments, public, economy) with a simple, calibrated, responsive one.
- **Done when:** a no-player world in each timeline behaves sensibly. Reality holds to Nov 2026; after that the world
  reacts to milestones reached in the game, and the leading rival lab carries the timeline.
- **Core work:** remove the junk; build the shared inputs, public, US government and China; an events and levers pass
  limited to the outside world; the no-player test.
- **Rides along:** the setup cleanup.
- **Plans A–D:** a check after the build; add at most the treaty compute cap.
- **Parked:** the AI 2027 sweep beyond the outside world (names, the end-screen line); the AI 2027-sourced lab
  parameters are only listed and handed to `bal` at merge; the UI waits until after the test, with a minimal stub
  before then; the player's lab is out of scope.

> good, we seem aligned.
> and as a general rule - we leave code cleaner than we found it.

## 11. Shape decisions after the built-world grid

The lead's questions:
- (1) Verified treaties come too easily with no player: should verification also need US concern > 70 and the leading
  labs accepting testing?
- (2) The 2026 milestone-2 problem: hand it to `bal` as a shared-history issue?
- (3) Taiwan disruptions: apply China's tension multiplier only from tension 3?

> the questions:
> 1. treaties - i accept suggestion
> 2. ok
> 3. maybe have a lower factor for lower tension and not none?

## 12. Treaty frequency after the W6c grid

The lead's question: treaties come once concern passes 70 (13 of 24 runs). Keep that, or make them rarer?

> the treat is ok for now.

## 13. UI proposal decisions

> did you drop most technologies from world-tech, or just didnt show in the mockup?
> is the risk subtab updated and wired to the new world we just built?
>
> decisions:
> 1. yes
> 2. yes
> 3. badge only
> 4. yes
> 5. yes
> 6. events only
>
> the mocups look good

(1 rename Relations → Powers; 2 pledges on Powers; 3 nav badge only, nothing in the top bar; 4 providers → link to
Finance › Story; 5 keep three adoption numbers; 6 treaty talks are events only.)

## 14. Cleanup timing; economy parked

> should we start the cleanup in the meantime? or will it cause a mess?
>
> i think park the economy quesiton for now, keep it for a later session
