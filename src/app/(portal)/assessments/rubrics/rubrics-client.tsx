import { PageHeader } from "@/components/ui/primitives";
import { CBC_LEVEL_BANDS } from "@/lib/grading";

export default function RubricsClient() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CBC Exam Grading Scale"
        help="The eight score bands used consistently in exams, learner summaries and report cards."
      />
      <p className="rounded-2xl border border-border-button-default bg-background-secondary-default p-4 text-body-2-regular text-text-secondary">
        Exam grades use the Mary Royal School formula. Score boundaries are fixed so the same mark receives the same grade everywhere.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CBC_LEVEL_BANDS.map((band) => (
          <article key={band.code} className="rounded-3xl border border-border-button-default bg-background-primary-default p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-title-3-semibold text-text-primary">{band.code}</h2>
              <span className="text-body-medium text-text-secondary">{band.min}–{band.maxExclusive === null ? "100" : `<${band.maxExclusive}`}%</span>
            </div>
            <p className="mt-3 text-body-regular text-text-primary">{band.descriptor}</p>
          </article>
        ))}
      </div>
      <p className="text-body-2-regular text-text-tertiary">
        EE = Exceeding Expectations · ME = Meeting Expectations · AE = Approaching Expectations · BE = Below Expectations.
        The number distinguishes the two score bands within each descriptor.
      </p>
    </div>
  );
}
