// Package grades holds the pure grade arithmetic used by the exam office,
// lecturers and the student record. No database access lives here so the rules
// can be unit tested.
//
// Model: every component carries a weight (percent) and a max points value.
// The lecturer enters raw points; the subject total is the weighted average on
// a 0-100 scale, mapped to the Albanian 4-10 grade through the bands stored in
// the grade_scales table (editable per school year).
package grades

import "math"

// Band maps a 0-100 point range to a 4-10 grade.
type Band struct {
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Grade float64 `json:"grade"`
}

// DefaultBands is the Albanian scale: pass >= 5.
var DefaultBands = []Band{
	{Min: 91, Max: 100, Grade: 10},
	{Min: 81, Max: 90, Grade: 9},
	{Min: 71, Max: 80, Grade: 8},
	{Min: 61, Max: 70, Grade: 7},
	{Min: 51, Max: 60, Grade: 6},
	{Min: 41, Max: 50, Grade: 5},
	{Min: 0, Max: 40, Grade: 4},
}

// DefaultPassGrade is the lowest passing grade on the 4-10 scale.
const DefaultPassGrade = 5

func clamp(v, min, max float64) float64 {
	return math.Min(math.Max(v, min), max)
}

// PointsToGrade maps a 0-100 total to the 4-10 grade. When bands overlap the
// highest grade wins; points outside every band fall back to the nearest edge.
func PointsToGrade(points float64, bands []Band) float64 {
	safe := clamp(points, 0, 100)
	if len(bands) == 0 {
		bands = DefaultBands
	}

	best := math.Inf(-1)
	found := false
	for _, band := range bands {
		if safe >= band.Min && safe <= band.Max {
			if !found || band.Grade > best {
				best = band.Grade
				found = true
			}
		}
	}
	if found {
		return best
	}

	lowest, highest := bands[0], bands[0]
	for _, band := range bands {
		if band.Min < lowest.Min {
			lowest = band
		}
		if band.Max > highest.Max {
			highest = band
		}
	}
	if safe < lowest.Min {
		return lowest.Grade
	}
	return highest.Grade
}

// IsPass reports whether a 4-10 grade passes.
func IsPass(grade, passGrade float64) bool {
	if passGrade <= 0 {
		passGrade = DefaultPassGrade
	}
	return grade >= passGrade
}

// Component is one graded item of a subject.
type Component struct {
	ID        string
	Name      string
	Weight    float64
	MaxPoints float64
	Points    *float64
}

// Total is the weighted result of a set of components.
type Total struct {
	// Points is the 0-100 weighted total, nil when nothing is graded yet.
	Points *float64
	// Grade is the 4-10 equivalent, nil when Points is nil.
	Grade *float64
	// Coverage is the share of the subject weight that has been graded (0-1).
	Coverage float64
	// Weight is the sum of all component weights (should be 100).
	Weight float64
	// Missing lists the components that still have no points.
	Missing []string
}

// WeightedTotal averages the graded components. Only components with points
// take part, so a half-graded subject shows a provisional total plus coverage.
func WeightedTotal(components []Component, bands []Band) Total {
	total := Total{Weight: 0, Missing: []string{}}
	var gradedWeight, weightedPoints float64

	for _, component := range components {
		weight := math.Max(component.Weight, 0)
		total.Weight += weight

		if component.Points == nil {
			if weight > 0 {
				total.Missing = append(total.Missing, component.ID)
			}
			continue
		}

		maxPoints := component.MaxPoints
		if maxPoints <= 0 {
			maxPoints = 100
		}
		normalized := clamp(*component.Points/maxPoints*100, 0, 100)
		weightedPoints += normalized * weight
		gradedWeight += weight
	}

	if total.Weight > 0 {
		total.Coverage = math.Min(gradedWeight/total.Weight, 1)
	}
	if gradedWeight <= 0 {
		return total
	}

	points := math.Round((weightedPoints/gradedWeight)*100) / 100
	grade := PointsToGrade(points, bands)
	total.Points = &points
	total.Grade = &grade
	return total
}

// Result is one subject on a student's study card.
type Result struct {
	Grade  *float64
	ECTS   *float64
	Status string // passed | failed | in_progress | withdrawn
}

// Summary aggregates a study card.
type Summary struct {
	// GPA is the ECTS-weighted average of the 4-10 grades over passed subjects.
	GPA             *float64
	CreditsEarned   float64
	CreditsInFlight float64
	SubjectsPassed  int
	SubjectsFailed  int
}

// Summarise computes the ECTS-weighted GPA and credit totals.
func Summarise(results []Result) Summary {
	var summary Summary
	var weighted, weight float64

	for _, result := range results {
		credits := 0.0
		if result.ECTS != nil {
			credits = *result.ECTS
		}

		switch result.Status {
		case "passed":
			summary.SubjectsPassed++
			summary.CreditsEarned += credits
			if result.Grade != nil && credits > 0 {
				weighted += *result.Grade * credits
				weight += credits
			}
		case "failed":
			summary.SubjectsFailed++
		case "in_progress":
			summary.CreditsInFlight += credits
		}
	}

	if weight > 0 {
		gpa := math.Round((weighted/weight)*100) / 100
		summary.GPA = &gpa
	}
	summary.CreditsEarned = math.Round(summary.CreditsEarned*10) / 10
	summary.CreditsInFlight = math.Round(summary.CreditsInFlight*10) / 10
	return summary
}

// StatusFor classifies a subject result from its total and coverage. Only a
// fully graded subject can be passed or failed.
func StatusFor(grade *float64, coverage float64, passGrade float64) string {
	if grade == nil {
		return "in_progress"
	}
	if coverage < 1 {
		return "in_progress"
	}
	if IsPass(*grade, passGrade) {
		return "passed"
	}
	return "failed"
}
