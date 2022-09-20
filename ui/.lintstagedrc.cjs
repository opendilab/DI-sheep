/**
 * lint-staged config
 * @ref https://www.npmjs.com/package/lint-staged
 * @desc generated at 9/15/2022, 12:52:11 PM by streakingman-cli@1.9.2
 */

module.exports = {
    '!(dist/**/*)*.{[tj]s,[tj]sx,[cm]js}': ['eslint --fix'],
    '!(dist/**/*)*.json': ['prettier --write'],
    '!(dist/**/*)*.{css,scss}': ['stylelint --fix'],
};
