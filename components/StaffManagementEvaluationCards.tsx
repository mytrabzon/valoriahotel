import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '@/constants/theme';
import {
  MGMT_EVAL_STAR_KEYS,
  type MgmtEvalStarKey,
  type StaffManagementEvaluationRow,
  parseOverallAvg,
  starsText,
} from '@/lib/managementEvaluation';
import { formatDateShort } from '@/lib/date';

type Props = {
  rows: StaffManagementEvaluationRow[];
  evaluatorNames: Record<string, string | null>;
  showAcknowledge?: boolean;
  onAcknowledge?: (id: string) => void;
  acknowledgingId?: string | null;
};

function criterionLabel(t: (k: string) => string, key: MgmtEvalStarKey): string {
  const map: Record<MgmtEvalStarKey, string> = {
    star_teamwork: t('mgmtEvalStarTeamwork'),
    star_discipline: t('mgmtEvalStarDiscipline'),
    star_job_skills: t('mgmtEvalStarJobSkills'),
    star_respect_peers: t('mgmtEvalStarRespectPeers'),
    star_rule_compliance: t('mgmtEvalStarRuleCompliance'),
    star_communication: t('mgmtEvalStarCommunication'),
    star_initiative: t('mgmtEvalStarInitiative'),
    star_guest_focus: t('mgmtEvalStarGuestFocus'),
    star_punctuality: t('mgmtEvalStarPunctuality'),
  };
  return map[key];
}

export function StaffManagementEvaluationCards({
  rows,
  evaluatorNames,
  showAcknowledge,
  onAcknowledge,
  acknowledgingId,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t('mgmtEvalSectionTitle')}</Text>
      <Text style={styles.hint}>{t('mgmtEvalStaffHint')}</Text>
      {!rows.length ? (
        <Text style={styles.empty}>{t('mgmtEvalNone')}</Text>
      ) : null}
      {rows.map((row) => {
        const avg = parseOverallAvg(row.overall_star_avg);
        const period =
          row.period_title?.trim() ||
          [row.period_start, row.period_end].filter(Boolean).join(' → ') ||
          null;
        const evalName = evaluatorNames[row.evaluator_staff_id] ?? '—';
        return (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.dateLine}>
                {formatDateShort(row.created_at)} · {evalName}
              </Text>
              {avg != null ? (
                <Text style={styles.avg}>
                  {t('mgmtEvalOverall')}: {avg.toFixed(1)} / 5 ({starsText(avg)})
                </Text>
              ) : null}
              {period ? <Text style={styles.period}>{period}</Text> : null}
            </View>
            {MGMT_EVAL_STAR_KEYS.map((key) => (
              <View key={key} style={styles.critRow}>
                <Text style={styles.critLabel} numberOfLines={2}>
                  {criterionLabel(t, key)}
                </Text>
                <Text style={styles.critStars}>{starsText(row[key] as number)}</Text>
              </View>
            ))}
            {row.manager_comment?.trim() ? (
              <View style={styles.commentBlock}>
                <Text style={styles.commentLabel}>{t('mgmtEvalManagerComment')}</Text>
                <Text style={styles.commentBody}>{row.manager_comment.trim()}</Text>
              </View>
            ) : null}
            {showAcknowledge && onAcknowledge ? (
              row.staff_acknowledged_at ? (
                <Text style={styles.acked}>{t('mgmtEvalAcknowledged')}</Text>
              ) : (
                <TouchableOpacity
                  style={styles.ackBtn}
                  onPress={() => onAcknowledge(row.id)}
                  disabled={acknowledgingId === row.id}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ackBtnText}>{t('mgmtEvalAcknowledge')}</Text>
                </TouchableOpacity>
              )
            ) : null}
          </View>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 18,
  },
  empty: { fontSize: 14, color: theme.colors.textMuted, fontStyle: 'italic' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cardHead: { marginBottom: 10 },
  dateLine: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  avg: { fontSize: 14, fontWeight: '600', color: theme.colors.primary, marginTop: 4 },
  period: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  critRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderLight,
  },
  critLabel: { flex: 1, fontSize: 13, color: theme.colors.text },
  critStars: { fontSize: 14, color: '#f59e0b', letterSpacing: 0.5 },
  commentBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderLight },
  commentLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 4 },
  commentBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  ackBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  ackBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  acked: { marginTop: 10, fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
});
