# Installation
> `npm install --save @types/validate-npm-package-name`

# Summary
This package contains type definitions for validate-npm-package-name (https://github.com/npm/validate-npm-package-name).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/validate-npm-package-name.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/validate-npm-package-name/index.d.ts)
````ts
declare namespace validate {
    interface Results {
        validForNewPackages: boolean;
        validForOldPackages: boolean;
        errors?: string[] | undefined;
        warnings?: string[] | undefined;
    }

    interface ValidNames extends Results {
        validForNewPackages: true;
        validForOldPackages: true;
    }

    interface InvalidNames extends Results {
        validForNewPackages: false;
        validForOldPackages: false;
        errors: string[];
    }

    interface LegacyNames extends Results {
        validForNewPackages: false;
        validForOldPackages: true;
        warnings: string[];
    }
}

declare function validate(name: string): validate.ValidNames | validate.InvalidNames | validate.LegacyNames;

export = validate;

````

### Additional Details
 * Last updated: Tue, 07 Nov 2023 15:11:36 GMT
 * Dependencies: none

# Credits
These definitions were written by [Florian Keller](https://github.com/ffflorian), and [Piotr Błażejewicz](https://github.com/peterblazejewicz).
